"use server";

import { readRatings } from "@/lib/rating/playerRatings";
import type { Language } from "@/lib/types/game-config";
import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { determineMatchWinner, type MatchWinnerResult } from "@/lib/match/resultCalculator";
import { writeMatchLog } from "@/lib/match/logWriter";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { MatchEndedReason, ScoreTotals, FrozenTileMap } from "@/lib/types/match";
import { computeFrozenTileCountByPlayer } from "@/lib/match/matchSummary";
import { timeoutPenalty } from "@/lib/scoring/missPenalty";
import { trackMatchResult } from "@/lib/observability/log";
import { markUnseenResult } from "@/lib/match/unseenResult";
import { pokePlayers } from "@/lib/realtime/pokes";
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
  language: Language | null;
}

/**
 * `natural` means: decide by the rules (spec 050 FR-010); the reason comes out of the decision.
 * `ended_early` (spec 071) settles the same way but records that the match was ended early.
 */
export type CompletionReason = MatchEndedReason | "natural";

/** Unplayed moves are penalised, as at 0:00, for a natural end and for an early end. */
function settlesNaturally(reason: CompletionReason): boolean {
  return reason === "natural" || reason === "ended_early";
}

export interface CompleteMatchResult {
  matchId: string;
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  scores: ScoreTotals;
  endedReason: MatchEndedReason;
  ratingChanges?: RatingChange;
  /** True when this call flipped the match; false when it found the result already written. */
  applied: boolean;
}

type Client = ReturnType<typeof getServiceRoleClient>;

const MATCH_COLUMNS =
  "id,state,player_a_id,player_b_id,winner_id,ended_reason,move_limit,frozen_tiles,player_a_score,player_b_score,player_a_moves,player_b_moves,language";

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
    applied: false,
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
  const natural = decideNaturally(match);
  if (reason === "natural") return natural;
  if (forcedWinnerId !== undefined) {
    return { winnerId: forcedWinnerId, loserId: otherPlayer(match, forcedWinnerId), isDraw: false, reason };
  }
  return { ...natural, reason };
}

function withPenalty(total: number, unplayed: number): number {
  return total + timeoutPenalty(total, unplayed);
}

/**
 * At a natural end (rules §2a, §5.6, 2026-09-21) every move a player has not
 * made is a miss: it is penalised into their total before the winner is
 * decided, so running out of time costs points rather than the match. Like
 * any miss, they never take a total below 0.
 */
function withTimeoutPenalties(match: MatchRow): MatchRow {
  const limit = match.move_limit ?? 10;
  return {
    ...match,
    player_a_score: withPenalty(match.player_a_score ?? 0, limit - (match.player_a_moves ?? 0)),
    player_b_score: withPenalty(match.player_b_score ?? 0, limit - (match.player_b_moves ?? 0)),
  };
}

/**
 * The completion compare-and-set (spec 050 FR-011): true when this call flipped
 * the match. The final totals (with any timeout penalties) are written in the
 * same update, so they are applied exactly once.
 */
async function flipToCompleted(client: Client, matchId: string, decision: Decision, finalScores: ScoreTotals | null): Promise<boolean> {
  const { data, error } = await client
    .from("matches")
    .update({
      state: "completed",
      winner_id: decision.winnerId,
      ended_reason: decision.reason,
      ...(finalScores ? { player_a_score: finalScores.playerA, player_b_score: finalScores.playerB } : {}),
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
    return await applyRatingChanges(client, match, decision);
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

  const settled = settlesNaturally(reason) ? withTimeoutPenalties(match) : match;
  const decision = decide(settled, reason, forcedWinnerId);
  const scores = scoresOf(settled);

  // Three triggers may race here (the resolver, a state poll, the cron sweep,
  // the orphan sweep). Whoever flips the row first owns the ratings; the rest
  // return what was written.
  if (!(await flipToCompleted(supabase, matchId, decision, settlesNaturally(reason) ? scores : null))) {
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
  await markUnseenResult(matchId);
  // Spec 070 US9: every tab of both players hears the match end, whatever page it is on.
  await pokePlayers([match.player_a_id, match.player_b_id], "match");

  trackMatchResult({
    matchId,
    winnerId: decision.winnerId,
    loserId: decision.loserId,
    endedReason: decision.reason,
    isDraw: decision.isDraw,
    scores,
    moveLimit: match.move_limit,
  });

  return {
    matchId,
    winnerId: decision.winnerId,
    loserId: decision.loserId,
    isDraw: decision.isDraw,
    scores,
    endedReason: decision.reason,
    ratingChanges,
    applied: true,
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

/** Elo in the match's language (spec 060 US4): each player's rating there, 1200 if they have none. */
async function applyRatingChanges(
  supabase: Client,
  match: Pick<MatchRow, "id" | "player_a_id" | "player_b_id" | "language">,
  winnerResult: { winnerId: string | null; isDraw: boolean },
): Promise<RatingChange> {
  const { id: matchId, player_a_id: playerAId, player_b_id: playerBId } = match;
  const language = match.language ?? "is";
  const records = await readRatings(supabase, [playerAId, playerBId], language);
  const beforeA = records.get(playerAId)!;
  const beforeB = records.get(playerBId)!;
  const pA = { elo_rating: beforeA.eloRating, games_played: beforeA.gamesPlayed };
  const pB = { elo_rating: beforeB.eloRating, games_played: beforeB.gamesPlayed };

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

  await persistRatingChanges(matchId, {
    language,
    playerA: { ...resultA, before: beforeA },
    playerB: { ...resultB, before: beforeB },
  });

  return {
    playerADelta: eloA.delta,
    playerBDelta: eloB.delta,
    playerARatingAfter: eloA.newRating,
    playerBRatingAfter: eloB.newRating,
  };
}
