import type { SupabaseClient } from "@supabase/supabase-js";

import { boardGridSchema } from "@/lib/types/board";
import type { Coordinate } from "@/lib/types/board";
import { aggregateRoundSummary } from "@/lib/scoring/roundSummary";
import type {
  MatchPhase,
  MatchState,
  RoundSummary,
  ScoreTotals,
  WordScore,
} from "@/lib/types/match";
import { generateBoard } from "@/scripts/supabase/generateBoard";
import { computeRemainingMs } from "./clockEnforcer";

type AnyClient = SupabaseClient<any, any, any>;

function mapState(roundState: string | null | undefined, matchState: string): MatchPhase {
  if (
    roundState === "collecting" ||
    roundState === "resolving" ||
    roundState === "completed"
  ) {
    return roundState;
  }

  if (matchState === "pending") {
    return "pending";
  }
  if (matchState === "completed") {
    return "completed";
  }
  if (matchState === "abandoned") {
    return "abandoned";
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
): Promise<RoundSummary | null> {
  const summaryRound = currentRound - 1;
  if (summaryRound < 1) {
    return null;
  }

  const round = await fetchCompletedRound(client, matchId, summaryRound);
  if (!round) {
    return null;
  }

  const wordEntries = await fetchWordEntries(client, matchId, round.id);
  if (!wordEntries) {
    return null;
  }

  const previousTotals = await fetchPreviousTotals(client, matchId, summaryRound);
  const wordScores = mapWordScores(wordEntries);
  return aggregateRoundSummary(matchId, summaryRound, wordScores, previousTotals);
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
        frozen_tiles
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

  const { data: round } = await client
    .from("rounds")
    .select("state, board_snapshot_before, board_snapshot_after, started_at")
    .eq("match_id", matchId)
    .eq("round_number", match.current_round)
    .maybeSingle();

  const scoresSnapshotRound = Math.max(match.current_round - 1, 0);
  const { data: scoreboard } = await client
    .from("scoreboard_snapshots")
    .select("player_a_score, player_b_score")
    .eq("match_id", matchId)
    .eq("round_number", scoresSnapshotRound)
    .maybeSingle();

  const scores: ScoreTotals = scoreboard
    ? {
        playerA: scoreboard.player_a_score ?? 0,
        playerB: scoreboard.player_b_score ?? 0,
      }
    : { playerA: 0, playerB: 0 };

  const board = ensureBoardSnapshot(match.id, match.board_seed, round ?? null);
  const effectiveState = mapState(round?.state ?? null, match.state);
  const lastSummary = await loadLatestRoundSummary(client, matchId, match.current_round);

  // Compute mid-round remaining time from round.started_at when in collecting state
  const roundStartedAt =
    round?.started_at && round.state === "collecting"
      ? new Date(round.started_at as string)
      : null;

  const playerARemainingMs = roundStartedAt
    ? computeRemainingMs(roundStartedAt, match.player_a_timer_ms ?? 300_000)
    : (match.player_a_timer_ms ?? 300_000);

  const playerBRemainingMs = roundStartedAt
    ? computeRemainingMs(roundStartedAt, match.player_b_timer_ms ?? 300_000)
    : (match.player_b_timer_ms ?? 300_000);

  return {
    matchId: match.id,
    board,
    currentRound: match.current_round,
    state: effectiveState,
    timers: {
      playerA: {
        playerId: match.player_a_id,
        remainingMs: playerARemainingMs,
        status: match.state === "completed" ? "expired" : "running",
      },
      playerB: {
        playerId: match.player_b_id,
        remainingMs: playerBRemainingMs,
        status: match.state === "completed" ? "expired" : "running",
      },
    },
    scores,
    lastSummary,
    frozenTiles: (match as any).frozen_tiles ?? {},
  };
}

