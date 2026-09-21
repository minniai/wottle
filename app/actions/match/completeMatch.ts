"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { determineMatchWinner, type MatchWinnerResult } from "@/lib/match/resultCalculator";
import { writeMatchLog } from "@/lib/match/logWriter";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { MatchEndedReason, ScoreTotals, FrozenTileMap } from "@/lib/types/match";
import { computeFrozenTileCountByPlayer } from "@/lib/match/matchSummary";
import { trackMatchResult } from "@/lib/observability/log";
import { calculateElo, determineKFactor } from "@/lib/rating/calculateElo";
import { persistRatingChanges } from "@/lib/rating/persistRatingChanges";
import type { RatingChange, MatchRatingResult } from "@/lib/types/match";

interface MatchRow {
  id: string;
  state: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  ended_reason: string | null;
  move_limit: number;
  frozen_tiles: Record<string, unknown> | null;
  player_a_score: number;
  player_b_score: number;
  player_a_moves: number;
  player_b_moves: number;
}

/** `natural` means: decide by the rules (spec 050 FR-010); the reason comes out of the decision. */
export type CompletionReason = MatchEndedReason | "natural";

export interface CompleteMatchResult {
  matchId: string;
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  scores: ScoreTotals;
  endedReason: MatchEndedReason;
  ratingChanges?: RatingChange;
}

type Client = ReturnType<typeof getServiceRoleClient>;

const MATCH_COLUMNS =
  "id,state,player_a_id,player_b_id,winner_id,ended_reason,move_limit,frozen_tiles,player_a_score,player_b_score,player_a_moves,player_b_moves";

async function fetchMatch(client: Client, matchId: string): Promise<MatchRow> {
  const { data, error } = await client.from("matches").select(MATCH_COLUMNS).eq("id", matchId).single();
  if (error || !data) {
    throw new Error(error?.message ?? "Match not found.");
  }
  return data as MatchRow;
}

function scoresOf(match: MatchRow): ScoreTotals {
  return { playerA: match.player_a_score ?? 0, playerB: match.player_b_score ?? 0 };
}

function otherPlayer(match: MatchRow, playerId: string): string {
  return playerId === match.player_a_id ? match.player_b_id : match.player_a_id;
}

function existingResult(match: MatchRow, fallbackReason: MatchEndedReason): CompleteMatchResult {
  const winnerId = match.winner_id;
  return {
    matchId: match.id,
    winnerId,
    loserId: winnerId ? otherPlayer(match, winnerId) : null,
    isDraw: false,
    scores: scoresOf(match),
    endedReason: (match.ended_reason as MatchEndedReason) ?? fallbackReason,
  };
}

interface Decision {
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  reason: MatchEndedReason;
}

function decideNaturally(match: MatchRow): MatchWinnerResult {
  return determineMatchWinner(
    {
      scores: scoresOf(match),
      moves: { playerA: match.player_a_moves ?? 0, playerB: match.player_b_moves ?? 0 },
      moveLimit: match.move_limit ?? 10,
      frozenCounts: computeFrozenTileCountByPlayer((match.frozen_tiles as FrozenTileMap) ?? {}),
    },
    match.player_a_id,
    match.player_b_id,
  );
}

/**
 * Abandoned records no winner. A forced winner (a resignation, a claim) wins
 * with the given reason. Everything else is decided by the rules; a natural
 * end takes its reason from the decision, a forced reason keeps its own.
 */
function decide(match: MatchRow, reason: CompletionReason, forcedWinnerId?: string): Decision {
  if (reason === "abandoned") return { winnerId: null, loserId: null, isDraw: false, reason };
  if (forcedWinnerId !== undefined) {
    return { winnerId: forcedWinnerId, loserId: otherPlayer(match, forcedWinnerId), isDraw: false, reason };
  }
  const natural = decideNaturally(match);
  return { ...natural, reason: reason === "natural" ? natural.reason : reason };
}

/** The completion compare-and-set (spec 050 FR-011): true when this call flipped the match. */
async function flipToCompleted(client: Client, matchId: string, decision: Decision): Promise<boolean> {
  const { data, error } = await client
    .from("matches")
    .update({
      state: "completed",
      winner_id: decision.winnerId,
      ended_reason: decision.reason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .in("state", ["pending", "in_progress"])
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

async function resetPlayerStatuses(client: Client, playerIds: string[]) {
  if (playerIds.length === 0) {
    return;
  }

  await client
    .from("players")
    .update({
      status: "available",
      last_seen_at: new Date().toISOString(),
    })
    .in("id", playerIds);

  await client
    .from("lobby_presence")
    .update({
      mode: "auto",
      invite_token: null,
      updated_at: new Date().toISOString(),
    })
    .in("player_id", playerIds);
}

async function rateIfRated(client: Client, match: MatchRow, decision: Decision): Promise<RatingChange | undefined> {
  if (decision.reason === "abandoned") return undefined;
  try {
    return await applyRatingChanges(client, match.id, match.player_a_id, match.player_b_id, decision);
  } catch (err) {
    console.error(
      JSON.stringify({ event: "rating.update.error", matchId: match.id, error: err instanceof Error ? err.message : String(err) }),
    );
    return undefined;
  }
}

export async function completeMatchInternal(
  matchId: string,
  reason: CompletionReason,
  forcedWinnerId?: string,
): Promise<CompleteMatchResult> {
  const supabase = getServiceRoleClient();
  const match = await fetchMatch(supabase, matchId);
  const fallback: MatchEndedReason = reason === "natural" ? "moves_complete" : reason;

  if (match.state === "completed") {
    return existingResult(match, fallback);
  }

  const decision = decide(match, reason, forcedWinnerId);
  const scores = scoresOf(match);

  // Three triggers may race here (the resolver, a state poll, the cron sweep,
  // the orphan sweep). Whoever flips the row first owns the ratings; the rest
  // return what was written.
  if (!(await flipToCompleted(supabase, matchId, decision))) {
    return existingResult(await fetchMatch(supabase, matchId), fallback);
  }

  const ratingChanges = await rateIfRated(supabase, match, decision);

  await resetPlayerStatuses(supabase, [match.player_a_id, match.player_b_id]);

  await writeMatchLog(supabase, {
    matchId,
    eventType: decision.reason === "moves_complete" ? "match.completed" : `match.${decision.reason}`,
    metadata: {
      winnerId: decision.winnerId,
      scores,
      moves: { playerA: match.player_a_moves, playerB: match.player_b_moves },
      ratingChanges,
    },
  });

  await publishMatchState(matchId);

  trackMatchResult({
    matchId,
    winnerId: decision.winnerId,
    loserId: decision.loserId,
    endedReason: decision.reason,
    isDraw: decision.isDraw,
    scores,
    totalRounds: match.move_limit,
  });

  return {
    matchId,
    winnerId: decision.winnerId,
    loserId: decision.loserId,
    isDraw: decision.isDraw,
    scores,
    endedReason: decision.reason,
    ratingChanges,
  };
}

export async function completeMatchAction(
  matchId: string,
  reason: CompletionReason = "natural",
): Promise<CompleteMatchResult> {
  const session = await readLobbySession();
  if (!session) {
    throw new Error("Authentication required.");
  }

  const supabase = getServiceRoleClient();
  const match = await fetchMatch(supabase, matchId);
  const isParticipant =
    session.player.id === match.player_a_id || session.player.id === match.player_b_id;

  if (!isParticipant) {
    throw new Error("You are not a participant in this match.");
  }

  return completeMatchInternal(matchId, reason);
}

async function applyRatingChanges(
  supabase: Client,
  matchId: string,
  playerAId: string,
  playerBId: string,
  winnerResult: { winnerId: string | null; isDraw: boolean },
): Promise<RatingChange> {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, elo_rating, games_played")
    .in("id", [playerAId, playerBId]);

  if (error || !players || players.length !== 2) {
    throw new Error("Failed to fetch player ratings.");
  }

  const pA = players.find((p) => p.id === playerAId)!;
  const pB = players.find((p) => p.id === playerBId)!;

  const scoreA = winnerResult.isDraw
    ? 0.5
    : winnerResult.winnerId === playerAId
      ? 1.0
      : 0.0;
  const scoreB = 1.0 - scoreA;

  const kA = determineKFactor(pA.games_played);
  const kB = determineKFactor(pB.games_played);

  const eloA = calculateElo({
    playerRating: pA.elo_rating,
    opponentRating: pB.elo_rating,
    actualScore: scoreA,
    kFactor: kA,
  });

  const eloB = calculateElo({
    playerRating: pB.elo_rating,
    opponentRating: pA.elo_rating,
    actualScore: scoreB,
    kFactor: kB,
  });

  const resultA: MatchRatingResult = {
    playerId: playerAId,
    ratingBefore: pA.elo_rating,
    ratingAfter: eloA.newRating,
    ratingDelta: eloA.delta,
    kFactor: kA,
    matchResult: winnerResult.isDraw
      ? "draw"
      : winnerResult.winnerId === playerAId
        ? "win"
        : "loss",
  };

  const resultB: MatchRatingResult = {
    playerId: playerBId,
    ratingBefore: pB.elo_rating,
    ratingAfter: eloB.newRating,
    ratingDelta: eloB.delta,
    kFactor: kB,
    matchResult: winnerResult.isDraw
      ? "draw"
      : winnerResult.winnerId === playerBId
        ? "win"
        : "loss",
  };

  await persistRatingChanges(matchId, resultA, resultB);

  return {
    playerADelta: eloA.delta,
    playerBDelta: eloB.delta,
    playerARatingAfter: eloA.newRating,
    playerBRatingAfter: eloB.newRating,
  };
}
