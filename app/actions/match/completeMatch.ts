"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { determineMatchWinner } from "@/lib/match/resultCalculator";
import { writeMatchLog } from "@/lib/match/logWriter";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { MatchEndedReason, ScoreTotals } from "@/lib/types/match";
import { trackMatchResult } from "@/lib/observability/log";

interface MatchRow {
  id: string;
  state: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  ended_reason: string | null;
  round_limit: number;
}

export interface CompleteMatchResult {
  matchId: string;
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  scores: ScoreTotals;
  endedReason: MatchEndedReason;
}

async function fetchMatch(client: ReturnType<typeof getServiceRoleClient>, matchId: string) {
  const { data, error } = await client
    .from("matches")
    .select("id,state,player_a_id,player_b_id,winner_id,ended_reason,round_limit")
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
): Promise<CompleteMatchResult> {
  const supabase = getServiceRoleClient();
  const match = await fetchMatch(supabase, matchId);

  if (match.state === "completed" && match.winner_id) {
    return {
      matchId,
      winnerId: match.winner_id,
      loserId:
        match.winner_id === match.player_a_id ? match.player_b_id : match.player_a_id,
      isDraw: false,
      scores: await fetchLatestScores(supabase, matchId),
      endedReason: (match.ended_reason as MatchEndedReason) ?? reason,
    };
  }

  const scores = await fetchLatestScores(supabase, matchId);
  const result = determineMatchWinner(scores, match.player_a_id, match.player_b_id);

  await supabase
    .from("matches")
    .update({
      state: "completed",
      winner_id: result.winnerId,
      ended_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  await resetPlayerStatuses(supabase, [match.player_a_id, match.player_b_id]);

  await writeMatchLog(supabase, {
    matchId,
    eventType: reason === "round_limit" ? "match.completed" : `match.${reason}`,
    metadata: {
      winnerId: result.winnerId,
      scores,
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

