"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { determineMatchWinner } from "@/lib/match/resultCalculator";
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
  round_limit: number;
  frozen_tiles: Record<string, unknown> | null;
}

export interface CompleteMatchResult {
  matchId: string;
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  scores: ScoreTotals;
  endedReason: MatchEndedReason;
  ratingChanges?: RatingChange;
}

async function fetchMatch(client: ReturnType<typeof getServiceRoleClient>, matchId: string) {
  const { data, error } = await client
    .from("matches")
    .select("id,state,player_a_id,player_b_id,winner_id,ended_reason,round_limit,frozen_tiles")
    .eq("id", matchId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Match not found.");
  }

  return data as MatchRow;
}

async function fetchLatestScores(
  client: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
): Promise<ScoreTotals> {
  const { data } = await client
    .from("scoreboard_snapshots")
    .select("round_number,player_a_score,player_b_score")
    .eq("match_id", matchId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { playerA: 0, playerB: 0 };
  }

  return {
    playerA: data.player_a_score ?? 0,
    playerB: data.player_b_score ?? 0,
  };
}

async function resetPlayerStatuses(
  client: ReturnType<typeof getServiceRoleClient>,
  playerIds: string[],
) {
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

export async function completeMatchInternal(
  matchId: string,
  reason: MatchEndedReason,
  forcedWinnerId?: string,
): Promise<CompleteMatchResult> {
  const supabase = getServiceRoleClient();
  const match = await fetchMatch(supabase, matchId);

  if (match.state === "completed") {
    const existingWinner = match.winner_id;
    return {
      matchId,
      winnerId: existingWinner,
      loserId: existingWinner
        ? existingWinner === match.player_a_id
          ? match.player_b_id
          : match.player_a_id
        : null,
      isDraw: false,
      scores: await fetchLatestScores(supabase, matchId),
      endedReason: (match.ended_reason as MatchEndedReason) ?? reason,
    };
  }

  const scores = await fetchLatestScores(supabase, matchId);
  const frozenCounts = computeFrozenTileCountByPlayer(
    (match.frozen_tiles as FrozenTileMap) ?? {},
  );
  // Disconnect flows award the still-connected / claiming player regardless of
  // score: loss of connection is treated as forfeit per Phase 6 spec §6.
  // Abandoned matches (sweep-finalised with no live presence on either side)
  // record no winner — there is no reliable signal for who "should" have won.
  const result =
    reason === "abandoned"
      ? { winnerId: null, loserId: null, isDraw: false }
      : forcedWinnerId !== undefined
        ? {
            winnerId: forcedWinnerId,
            loserId:
              forcedWinnerId === match.player_a_id
                ? match.player_b_id
                : match.player_a_id,
            isDraw: false,
          }
        : determineMatchWinner(
            scores,
            match.player_a_id,
            match.player_b_id,
            frozenCounts,
          );

  await supabase
    .from("matches")
    .update({
      state: "completed",
      winner_id: result.winnerId,
      ended_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  // Calculate and persist Elo rating changes — skip for abandoned matches
  // since no winner means no meaningful rating delta.
  let ratingChanges: RatingChange | undefined;
  if (reason !== "abandoned") {
    try {
      ratingChanges = await applyRatingChanges(
        supabase,
        matchId,
        match.player_a_id,
        match.player_b_id,
        result,
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "rating.update.error",
          matchId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  await resetPlayerStatuses(supabase, [match.player_a_id, match.player_b_id]);

  await writeMatchLog(supabase, {
    matchId,
    eventType: reason === "round_limit" ? "match.completed" : `match.${reason}`,
    metadata: {
      winnerId: result.winnerId,
      scores,
      ratingChanges,
    },
  });

  await publishMatchState(matchId);

  trackMatchResult({
    matchId,
    winnerId: result.winnerId,
    loserId: result.loserId,
    endedReason: reason,
    isDraw: result.isDraw,
    scores,
    totalRounds: match.round_limit,
  });

  return {
    matchId,
    winnerId: result.winnerId,
    loserId: result.loserId,
    isDraw: result.isDraw,
    scores,
    endedReason: reason,
    ratingChanges,
  };
}

export async function completeMatchAction(
  matchId: string,
  reason: MatchEndedReason = "round_limit",
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
  supabase: ReturnType<typeof getServiceRoleClient>,
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

