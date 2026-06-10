import { computeWordScoresForRound } from "@/app/actions/match/publishRoundSummary";
import { boardGridSchema } from "@/lib/types/board";
import type {
  FrozenTileMap,
  PartialRoundSummary,
  ScoreTotals,
  WordScore,
} from "@/lib/types/match";
import {
  trackInstantScoringDeferred,
  trackInstantScoringFailed,
  trackInstantScoringFired,
} from "@/lib/observability/instantScoring";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { publishMatchState } from "./statePublisher";

/**
 * Maximum wall-clock budget for the fast path. Generous vs the constitution's
 * <50 ms word-validation SLA — large enough to absorb a cold dictionary load
 * (≤2 s per AGENTS.md only on the *first* process startup) but tight enough
 * that pathological hangs fall through to the canonical combined-scoring
 * path on the second submission (FR-011, research Decision 6).
 */
const INSTANT_SCORING_TIMEOUT_MS = 500;

/**
 * Result of a single `instantScoreFirstSubmission` invocation. Discriminated
 * union so callers (tests, observability) can branch on the outcome without
 * inspecting log lines.
 *
 * The production caller (`submitMove`'s `after()` hook) ignores this return
 * value — the fast path is always best-effort and never blocks the caller.
 */
export type InstantScoringResult =
  | { status: "fired"; partial: PartialRoundSummary; durationMs: number }
  | { status: "deferred-to-combined"; reason: "race-window" | "no-submissions" }
  | { status: "no-score"; reason: "swap-produced-no-words" }
  | { status: "failed"; reason: string };

interface MatchRow {
  id: string;
  current_round: number;
  player_a_id: string;
  player_b_id: string;
  board_seed: string | null;
  frozen_tiles: Record<string, unknown> | null;
}

interface RoundRow {
  id: string;
  state: string;
  board_snapshot_before: unknown;
  started_at: string | null;
  frozen_tiles_before: Record<string, unknown> | null;
}

interface PendingSubmissionRow {
  id: string;
  player_id: string;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  submitted_at: string;
  status: string;
}

/**
 * Fast-path scoring for the first submission of a round (spec 042 / Linear O-57).
 *
 * Invoked from `submitMove`'s `after()` hook before falling through to
 * `advanceRound`. See `specs/042-instant-scoring-reveal/contracts/server-actions.md`
 * for the full contract. Summary:
 *
 * 1. Race-window check (FR-007): if ≥2 pending submissions exist, returns
 *    `deferred-to-combined` without doing scoring work.
 * 2. Otherwise loads the round + first submission + board + frozen tiles,
 *    runs `computeWordScoresForRound` for just the first mover's move
 *    (writes `word_score_entries` and updates `matches.frozen_tiles`), and
 *    broadcasts the updated `MatchState` (which now carries `partialSummary`
 *    via `loadMatchState`).
 *
 * Bounded by a 500 ms internal timeout (FR-011 / research Decision 6). On
 * throw or timeout it logs `instant-scoring.failed` and returns
 * `{status: "failed"}`; the combined path then runs normally.
 *
 * @param matchId UUID of the match. The fast path resolves the round and
 *   first submission from the DB itself — passing `submissionId` would be
 *   brittle under the `submitMove` ↔ fast-path race.
 */
export async function instantScoreFirstSubmission(
  matchId: string,
): Promise<InstantScoringResult> {
  const startedAt = performance.now();

  try {
    return await Promise.race([
      runFastPath(matchId, startedAt),
      timeoutAfter(INSTANT_SCORING_TIMEOUT_MS, matchId),
    ]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    trackInstantScoringFailed({ matchId, roundNumber: 0, reason });
    return { status: "failed", reason };
  }
}

async function runFastPath(
  matchId: string,
  startedAt: number,
): Promise<InstantScoringResult> {
  const supabase = getServiceRoleClient();

  const match = await loadMatch(supabase, matchId);
  if (!match) {
    return { status: "failed", reason: "match-not-found" };
  }

  const round = await loadCurrentRound(supabase, matchId, match.current_round);
  if (!round) {
    return { status: "failed", reason: "round-not-found" };
  }

  if (round.state !== "collecting") {
    return { status: "deferred-to-combined", reason: "race-window" };
  }

  const pending = await loadPendingSubmissions(supabase, round.id);

  // FR-007: defer to combined path when the second submission already arrived.
  if (pending.length >= 2) {
    trackInstantScoringDeferred({
      matchId,
      roundNumber: match.current_round,
      reason: "race-window",
    });
    return { status: "deferred-to-combined", reason: "race-window" };
  }

  if (pending.length === 0) {
    return { status: "deferred-to-combined", reason: "no-submissions" };
  }

  const firstMover = pending[0];

  let boardBefore: string[][];
  try {
    boardBefore = boardGridSchema.parse(round.board_snapshot_before);
  } catch {
    return { status: "failed", reason: "invalid-board-snapshot" };
  }

  // Scoring baseline: the freeze map as of round start. Mirrors the combined
  // pass in roundEngine — both paths MUST score against the same baseline so
  // the combined re-derivation reproduces the fast path's words instead of
  // rejecting the first mover's swap on its own freshly-frozen tiles.
  // Falls back to matches.frozen_tiles for legacy rounds.
  const frozenTiles = (round.frozen_tiles_before ??
    match.frozen_tiles ??
    {}) as Record<string, { owner: string }>;

  const scoringResult = await computeWordScoresForRound(
    matchId,
    round.id,
    match.current_round,
    boardBefore,
    [
      {
        player_id: firstMover.player_id,
        from_x: firstMover.from_x,
        from_y: firstMover.from_y,
        to_x: firstMover.to_x,
        to_y: firstMover.to_y,
        created_at: firstMover.submitted_at,
      },
    ],
    match.player_a_id,
    match.player_b_id,
    frozenTiles,
  );

  if (scoringResult.wordScores.length === 0) {
    return { status: "no-score", reason: "swap-produced-no-words" };
  }

  const partial = buildPartial(
    matchId,
    match,
    round.id,
    firstMover,
    scoringResult.wordScores,
  );

  // publishMatchState reads MatchState fresh via loadMatchState, which now
  // derives `partialSummary` from the word_score_entries we just wrote +
  // matches.frozen_tiles. So no manual state merging is needed here.
  await publishMatchState(matchId);

  const durationMs = performance.now() - startedAt;
  trackInstantScoringFired({
    matchId,
    roundNumber: match.current_round,
    playerId: firstMover.player_id,
    wordCount: partial.words.length,
    durationMs: Math.round(durationMs),
  });

  return { status: "fired", partial, durationMs };
}

function timeoutAfter(
  ms: number,
  matchId: string,
): Promise<InstantScoringResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      trackInstantScoringFailed({ matchId, roundNumber: 0, reason: "timeout" });
      resolve({ status: "failed", reason: "timeout" });
    }, ms);
  });
}

async function loadMatch(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
): Promise<MatchRow | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, current_round, player_a_id, player_b_id, board_seed, frozen_tiles",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load match ${matchId}: ${error.message}`);
  }
  return (data as MatchRow | null) ?? null;
}

async function loadCurrentRound(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
  currentRound: number,
): Promise<RoundRow | null> {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, state, board_snapshot_before, started_at, frozen_tiles_before")
    .eq("match_id", matchId)
    .eq("round_number", currentRound)
    .maybeSingle();
  if (error) {
    // Throwing (instead of returning null → "round-not-found") routes the
    // real Postgres error into trackInstantScoringFailed's reason. A missing
    // column in production previously hid behind the generic reason (O-62).
    throw new Error(
      `Failed to load round ${currentRound} of match ${matchId}: ${error.message}`,
    );
  }
  return (data as RoundRow | null) ?? null;
}

async function loadPendingSubmissions(
  supabase: ReturnType<typeof getServiceRoleClient>,
  roundId: string,
): Promise<PendingSubmissionRow[]> {
  const { data } = await supabase
    .from("move_submissions")
    .select("id, player_id, from_x, from_y, to_x, to_y, submitted_at, status")
    .eq("round_id", roundId)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
  return (data as PendingSubmissionRow[] | null) ?? [];
}

function buildPartial(
  matchId: string,
  match: MatchRow,
  _roundId: string,
  firstMover: PendingSubmissionRow,
  wordScores: WordScore[],
): PartialRoundSummary {
  const total = wordScores.reduce((sum, w) => sum + w.totalPoints, 0);
  const delta: ScoreTotals =
    firstMover.player_id === match.player_a_id
      ? { playerA: total, playerB: 0 }
      : { playerA: 0, playerB: total };

  // computeWordScoresForRound already merged the new freezes into
  // matches.frozen_tiles via persistFrozenTilesAtomically; we mirror that
  // state in the partial summary so consumers don't need a second query.
  const frozenTiles = (match.frozen_tiles ?? {}) as FrozenTileMap;

  return {
    matchId,
    roundNumber: match.current_round,
    firstMoverId: firstMover.player_id,
    firstSubmissionAt: firstMover.submitted_at,
    words: wordScores,
    delta,
    frozenTiles,
  };
}
