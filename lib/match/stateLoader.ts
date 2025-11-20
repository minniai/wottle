import type { SupabaseClient } from "@supabase/supabase-js";

import { boardGridSchema } from "@/lib/types/board";
import type { MatchPhase, MatchState, ScoreTotals } from "@/lib/types/match";
import { generateBoard } from "@/scripts/supabase/generateBoard";

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
        player_b_timer_ms
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

  const { data: round } = await client
    .from("rounds")
    .select("state, board_snapshot_before, board_snapshot_after")
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

  return {
    matchId: match.id,
    board,
    currentRound: match.current_round,
    state: effectiveState,
    timers: {
      playerA: {
        playerId: match.player_a_id,
        remainingMs: match.player_a_timer_ms ?? 300_000,
        status: match.state === "completed" ? "expired" : "running",
      },
      playerB: {
        playerId: match.player_b_id,
        remainingMs: match.player_b_timer_ms ?? 300_000,
        status: match.state === "completed" ? "expired" : "running",
      },
    },
    scores,
    lastSummary: null,
  };
}

