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

type AnyClient = SupabaseClient<any, any, any>;

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

  if (
    roundState === "collecting" ||
    roundState === "resolving" ||
    roundState === "completed"
  ) {
    return roundState;
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

  const wordEntries = await fetchWordEntries(client, matchId, round.id);
  if (!wordEntries) {
    return null;
  }

  const previousTotals = await fetchPreviousTotals(client, matchId, summaryRound);
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

  const { data: round } = await client
    .from("rounds")
    .select("id, state, board_snapshot_before, board_snapshot_after, started_at")
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
  const lastSummary = await loadLatestRoundSummary(client, matchId, match.current_round, match.player_a_id, match.player_b_id);

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
      .select("player_id, submitted_at")
      .eq("round_id", round.id);

    const subByPlayer = new Map<string, Date>(
      (submissions ?? []).map((s: { player_id: string; submitted_at: string }) => [
        s.player_id,
        new Date(s.submitted_at),
      ]),
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
  };
}

