import type { SupabaseClient } from "@supabase/supabase-js";

import { boardGridSchema } from "@/lib/types/board";
import type { Coordinate } from "@/lib/types/board";
import { aggregateRoundSummary } from "@/lib/scoring/roundSummary";
import type {
  MatchPhase,
  MatchPlayerProfile,
  MatchPlayerProfiles,
  MatchState,
  RoundSummary,
  ScoreTotals,
  WordScore,
} from "@/lib/types/match";
import { generateBoard } from "@/scripts/supabase/generateBoard";
import { computeElapsedMs, computeRemainingMs } from "./clockEnforcer";
import { getDisconnectRecord } from "./disconnectStore";

type AnyClient = SupabaseClient<any, any, any>;

/**
 * Matches currently being self-healed via background `advanceRound` trigger.
 * Gate against concurrent polls all firing advanceRound for the same stuck
 * round — the first one wins; the rest skip until it finishes (or fails).
 */
const pendingSelfHeals = new Set<string>();

/**
 * Stuck-round self-heal: when a client polls /state and we detect the round
 * is still in `collecting` despite both players having submitted, fire
 * `advanceRound(matchId)` in the background. `advanceRound` itself re-checks
 * round state at its top and exits early if resolution is already in flight,
 * so this is safe to call liberally.
 *
 * This is the primary backstop against the "stuck round 10" bug: if the
 * post-submit `after()` hook drops the advancement for any reason, the
 * client's next 2s safety poll will re-trigger it via this path.
 */
function triggerAdvanceInBackground(matchId: string): void {
  if (pendingSelfHeals.has(matchId)) return;
  pendingSelfHeals.add(matchId);
  void (async () => {
    try {
      const { advanceRound } = await import("./roundEngine");
      await advanceRound(matchId);
    } catch (error) {
      console.error("[stateLoader] self-heal advanceRound failed:", error);
    } finally {
      pendingSelfHeals.delete(matchId);
    }
  })();
}

/**
 * Extended self-heal: roll forward a round-advance that stalled *after*
 * entering the resolving/completed phase. `advanceRound`'s early-exit guard
 * (`round.state !== "collecting"`) means it can't recover these shapes, so we
 * delegate to `recoverStuckRound` which knows how to finish the pipeline
 * idempotently. Shares the same dedup set as advance self-heal — only one
 * background repair is ever in flight per match.
 */
function triggerRecoveryInBackground(matchId: string): void {
  if (pendingSelfHeals.has(matchId)) return;
  pendingSelfHeals.add(matchId);
  void (async () => {
    try {
      const { recoverStuckRound } = await import("./recoverStuckRound");
      await recoverStuckRound(matchId);
    } catch (error) {
      console.error("[stateLoader] self-heal recoverStuckRound failed:", error);
    } finally {
      pendingSelfHeals.delete(matchId);
    }
  })();
}

/**
 * How long a round may sit in `resolving` before we assume `advanceRound`
 * crashed mid-pipeline. The happy path takes <1s; 10s is well past any
 * legitimate run and matches the Realtime-subscribe timeout replaced in PR
 * #151.
 */
const RESOLVING_STALENESS_THRESHOLD_MS = 10_000;

/** @internal — test hook to reset the dedup set between runs. */
export function __resetSelfHealTrackerForTests(): void {
  pendingSelfHeals.clear();
}

function mapState(roundState: string | null | undefined, matchState: string): MatchPhase {
  // Match-level terminal states take precedence — a timeout or abandon can end the
  // match while the current round is still in "collecting" state (never advanced).
  if (matchState === "completed") {
    return "completed";
  }
  if (matchState === "abandoned") {
    return "abandoned";
  }
  if (matchState === "pending") {
    return "pending";
  }

  if (roundState === "collecting" || roundState === "resolving") {
    return roundState;
  }

  // A round with state "completed" while the match is still in_progress means
  // we're between rounds (round finished, next round not yet loaded). Map to
  // "resolving" rather than "completed" to avoid the client mistaking a
  // completed *round* for a completed *match* (which triggers "Rounds Complete").
  if (roundState === "completed") {
    return "resolving";
  }

  // in_progress or any other transient state defaults to collecting
  return "collecting";
}

function ensureBoardSnapshot(
  matchId: string,
  boardSeed: string | null,
  round: { board_snapshot_before: unknown; board_snapshot_after: unknown; state: string | null } | null,
): string[][] {
  const preferred =
    round && round.state === "completed" && round.board_snapshot_after
      ? round.board_snapshot_after
      : round?.board_snapshot_before;

  if (preferred) {
    try {
      return boardGridSchema.parse(preferred);
    } catch (error) {
      console.warn("[MatchState] Failed to parse board snapshot, regenerating board", error);
    }
  }

  return generateBoard({ matchId: boardSeed ?? matchId });
}

async function fetchCompletedRound(
  client: AnyClient,
  matchId: string,
  roundNumber: number,
) {
  const { data } = await client
    .from("rounds")
    .select("id,state")
    .eq("match_id", matchId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (!data || data.state !== "completed") {
    return null;
  }

  return data;
}

async function fetchWordEntries(client: AnyClient, matchId: string, roundId: string) {
  const { data, error } = await client
    .from("word_score_entries")
    .select("*")
    .eq("match_id", matchId)
    .eq("round_id", roundId);

  if (error) {
    console.warn("[MatchState] Failed to load word scores:", error.message);
    return null;
  }

  return data ?? [];
}

async function fetchPreviousTotals(
  client: AnyClient,
  matchId: string,
  roundNumber: number,
): Promise<ScoreTotals> {
  const { data } = await client
    .from("scoreboard_snapshots")
    .select("player_a_score,player_b_score")
    .eq("match_id", matchId)
    .eq("round_number", roundNumber - 1)
    .maybeSingle();

  return data
    ? {
        playerA: data.player_a_score ?? 0,
        playerB: data.player_b_score ?? 0,
      }
    : { playerA: 0, playerB: 0 };
}

function mapWordScores(entries: any[]): WordScore[] {
  return entries.map((entry) => ({
    playerId: entry.player_id as string,
    word: entry.word as string,
    length: entry.length as number,
    lettersPoints: entry.letters_points as number,
    bonusPoints: entry.bonus_points as number,
    totalPoints: entry.total_points as number,
    coordinates: entry.tiles as Coordinate[],
  }));
}

async function loadLatestRoundSummary(
  client: AnyClient,
  matchId: string,
  currentRound: number,
  playerAId: string,
  playerBId: string,
): Promise<RoundSummary | null> {
  const summaryRound = currentRound - 1;
  if (summaryRound < 1) {
    return null;
  }

  const round = await fetchCompletedRound(client, matchId, summaryRound);
  if (!round) {
    return null;
  }

  // Parallelize independent queries (both depend on round.id but not each other)
  const [wordEntries, previousTotals] = await Promise.all([
    fetchWordEntries(client, matchId, round.id),
    fetchPreviousTotals(client, matchId, summaryRound),
  ]);
  if (!wordEntries) {
    return null;
  }

  const wordScores = mapWordScores(wordEntries);
  return aggregateRoundSummary(matchId, summaryRound, wordScores, previousTotals, playerAId, playerBId);
}

function mapPlayerRow(
  row: { id: string; username: string; display_name: string; avatar_url: string | null; elo_rating: number | null },
): MatchPlayerProfile {
  return {
    playerId: row.id,
    displayName: row.display_name || row.username,
    username: row.username,
    avatarUrl: row.avatar_url,
    eloRating: row.elo_rating ?? 1200,
  };
}

function fallbackProfile(playerId: string, label: string): MatchPlayerProfile {
  return {
    playerId,
    displayName: label,
    username: label,
    avatarUrl: null,
    eloRating: 1200,
  };
}

export async function loadMatchPlayerProfiles(
  client: AnyClient,
  playerAId: string,
  playerBId: string,
): Promise<MatchPlayerProfiles> {
  const { data, error } = await client
    .from("players")
    .select("id, username, display_name, avatar_url, elo_rating")
    .in("id", [playerAId, playerBId]);

  if (error || !data) {
    console.warn("[MatchState] Failed to load player profiles:", error?.message);
    return {
      playerA: fallbackProfile(playerAId, "Player A"),
      playerB: fallbackProfile(playerBId, "Player B"),
    };
  }

  const byId = new Map(data.map((row: any) => [row.id, row]));
  const rowA = byId.get(playerAId);
  const rowB = byId.get(playerBId);

  return {
    playerA: rowA ? mapPlayerRow(rowA) : fallbackProfile(playerAId, "Player A"),
    playerB: rowB ? mapPlayerRow(rowB) : fallbackProfile(playerBId, "Player B"),
  };
}

export async function loadMatchState(
  client: AnyClient,
  matchId: string,
): Promise<MatchState | null> {
  const { data: match, error: matchError } = await client
    .from("matches")
    .select(
      `
        id,
        state,
        current_round,
        board_seed,
        player_a_id,
        player_b_id,
        player_a_timer_ms,
        player_b_timer_ms,
        frozen_tiles,
        winner_id
      `,
    )
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) {
    console.error("[MatchState] Failed to load match:", matchError);
    return null;
  }

  if (!match) {
    return null;
  }

  if (match.state === "pending") {
    const boardSeed = match.board_seed ?? match.id;
    const initialBoard = generateBoard({ matchId: boardSeed });

    await client
      .from("rounds")
      .upsert(
        {
          match_id: matchId,
          round_number: 1,
          state: "collecting",
          board_snapshot_before: initialBoard,
          started_at: new Date().toISOString(),
        },
        { onConflict: "match_id,round_number" },
      );

    await client
      .from("matches")
      .update({
        state: "in_progress",
        current_round: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    match.state = "in_progress";
    match.current_round = 1;
  }

  // Parallelize independent queries (all depend on match but not each other)
  const scoresSnapshotRound = Math.max(match.current_round - 1, 0);
  const [{ data: round }, { data: scoreboard }, lastSummary] = await Promise.all([
    client
      .from("rounds")
      .select("id, state, board_snapshot_before, board_snapshot_after, started_at, resolution_started_at")
      .eq("match_id", matchId)
      .eq("round_number", match.current_round)
      .maybeSingle(),
    client
      .from("scoreboard_snapshots")
      .select("player_a_score, player_b_score")
      .eq("match_id", matchId)
      .eq("round_number", scoresSnapshotRound)
      .maybeSingle(),
    loadLatestRoundSummary(client, matchId, match.current_round, match.player_a_id, match.player_b_id),
  ]);

  const scores: ScoreTotals = scoreboard
    ? {
        playerA: scoreboard.player_a_score ?? 0,
        playerB: scoreboard.player_b_score ?? 0,
      }
    : { playerA: 0, playerB: 0 };

  const board = ensureBoardSnapshot(match.id, match.board_seed, round ?? null);
  const effectiveState = mapState(round?.state ?? null, match.state);

  // Extended self-heal dispatch: PR #151's self-heal only covers stuck
  // "collecting" rounds. `advanceRound` can still stall *after* flipping the
  // round to "resolving" — step 10 Promise.all throw, Vercel `after()` hook
  // termination, word engine OOM on the 3.74M-entry dictionary, etc. Round
  // 10 is terminal (no follow-up submit to retry), so these partial-advance
  // shapes are what currently leave the match stuck after PR #151. Each
  // branch hands off to `recoverStuckRound` which rolls forward idempotently.
  const resolutionStartedAt =
    round?.resolution_started_at
      ? new Date(round.resolution_started_at as string)
      : null;
  const isResolvingStale =
    round?.state === "resolving"
    && resolutionStartedAt !== null
    && Date.now() - resolutionStartedAt.getTime() > RESOLVING_STALENESS_THRESHOLD_MS;
  const isPostRoundStall =
    round?.state === "completed" && match.state === "in_progress";
  const isMatchMissingWinner =
    match.state === "completed" && !(match as { winner_id?: string | null }).winner_id;
  if (isResolvingStale || isPostRoundStall || isMatchMissingWinner) {
    triggerRecoveryInBackground(matchId);
  }

  // Compute mid-round remaining time from round.started_at when in collecting state
  const roundStartedAt =
    round?.started_at && round.state === "collecting"
      ? new Date(round.started_at as string)
      : null;

  const storedA = match.player_a_timer_ms ?? 300_000;
  const storedB = match.player_b_timer_ms ?? 300_000;

  let playerARemainingMs: number;
  let playerBRemainingMs: number;
  let playerAStatus: "running" | "paused" | "expired";
  let playerBStatus: "running" | "paused" | "expired";

  if (match.state === "completed") {
    playerARemainingMs = storedA;
    playerBRemainingMs = storedB;
    playerAStatus = "expired";
    playerBStatus = "expired";
  } else if (effectiveState === "collecting" && roundStartedAt && round?.id) {
    const { data: submissions } = await client
      .from("move_submissions")
      .select("player_id, submitted_at, status")
      .eq("round_id", round.id);

    const typedSubs = (submissions ?? []) as Array<{
      player_id: string;
      submitted_at: string;
      status: string;
    }>;

    // Self-heal: if both players have real (non-timeout) submissions but the
    // round hasn't advanced, fire advanceRound in the background. This closes
    // the race where submitMove's `after()` hook drops the advancement.
    const nonTimeoutSubs = typedSubs.filter((s) => s.status !== "timeout");
    if (nonTimeoutSubs.length >= 2) {
      triggerAdvanceInBackground(matchId);
    }

    const subByPlayer = new Map<string, Date>(
      typedSubs.map((s) => [s.player_id, new Date(s.submitted_at)]),
    );
    const submittedAtA = subByPlayer.get(match.player_a_id);
    const submittedAtB = subByPlayer.get(match.player_b_id);

    if (submittedAtA) {
      const elapsed = computeElapsedMs(roundStartedAt, submittedAtA);
      playerARemainingMs = Math.max(0, storedA - elapsed);
      playerAStatus = "paused";
    } else {
      playerARemainingMs = computeRemainingMs(roundStartedAt, storedA);
      playerAStatus = "running";
    }
    if (submittedAtB) {
      const elapsed = computeElapsedMs(roundStartedAt, submittedAtB);
      playerBRemainingMs = Math.max(0, storedB - elapsed);
      playerBStatus = "paused";
    } else {
      playerBRemainingMs = computeRemainingMs(roundStartedAt, storedB);
      playerBStatus = "running";
    }
  } else {
    playerARemainingMs = roundStartedAt ? computeRemainingMs(roundStartedAt, storedA) : storedA;
    playerBRemainingMs = roundStartedAt ? computeRemainingMs(roundStartedAt, storedB) : storedB;
    playerAStatus = "running";
    playerBStatus = "running";
  }

  // Surface disconnect state in the polled snapshot. Sourced from
  // `disconnectStore`, which is populated by `handlePlayerDisconnect` when the
  // disconnecting client notifies us via sendBeacon, the Realtime `system:
  // CLOSED` handler, or the surviving client's `onOpponentLeave` presence
  // callback. The previous heartbeat-staleness fallback was removed in the
  // hotfix for issue #161 — the per-process Map gave inconsistent results
  // across serverless instances and produced flickering false positives.
  const disconnectedPlayerId =
    getDisconnectRecord(match.id, match.player_a_id)?.playerId ??
    getDisconnectRecord(match.id, match.player_b_id)?.playerId ??
    null;

  return {
    matchId: match.id,
    board,
    currentRound: match.current_round,
    state: effectiveState,
    timers: {
      playerA: {
        playerId: match.player_a_id,
        remainingMs: playerARemainingMs,
        status: playerAStatus,
      },
      playerB: {
        playerId: match.player_b_id,
        remainingMs: playerBRemainingMs,
        status: playerBStatus,
      },
    },
    scores,
    lastSummary,
    frozenTiles: (match as any).frozen_tiles ?? {},
    disconnectedPlayerId,
  };
}

