"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { writeMatchLog } from "@/lib/match/logWriter";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { trackMatchResult } from "@/lib/observability/log";

export interface ResignResult {
  matchId: string;
  winnerId: string;
  resigned: true;
}

export async function resignMatch(
  matchId: string,
): Promise<ResignResult> {
  const session = await readLobbySession();
  if (!session) {
    throw new Error("Authentication required.");
  }

  const playerId = session.player.id;

  assertWithinRateLimit({
    identifier: playerId,
    scope: "match:resign",
    limit: 5,
    windowMs: 60_000,
    errorMessage: "Too many resign attempts. Please wait.",
  });

  const supabase = getServiceRoleClient();

  const { data: match, error } = await supabase
    .from("matches")
    .select("id,state,player_a_id,player_b_id,winner_id")
    .eq("id", matchId)
    .single();

  if (error || !match) {
    throw new Error("Match not found.");
  }

  const isParticipant =
    playerId === match.player_a_id || playerId === match.player_b_id;

  if (!isParticipant) {
    throw new Error("You are not a participant in this match.");
  }

  if (match.state === "completed") {
    throw new Error("Match has already ended.");
  }

  const winnerId =
    playerId === match.player_a_id
      ? match.player_b_id
      : match.player_a_id;

  // Mark match as completed with forfeit — winner is the opponent
  await supabase
    .from("matches")
    .update({
      state: "completed",
      winner_id: winnerId,
      ended_reason: "forfeit",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  // Reset both players to available
  await supabase
    .from("players")
    .update({
      status: "available",
      last_seen_at: new Date().toISOString(),
    })
    .in("id", [match.player_a_id, match.player_b_id]);

  await writeMatchLog(supabase, {
    matchId,
    eventType: "match.forfeit",
    actorId: playerId,
    metadata: { winnerId, resignedBy: playerId },
  });

  await publishMatchState(matchId);

  trackMatchResult({
    matchId,
    winnerId,
    loserId: playerId,
    endedReason: "forfeit",
    isDraw: false,
    scores: { playerA: 0, playerB: 0 },
    totalRounds: 0,
  });

  return {
    matchId,
    winnerId,
    resigned: true,
  };
}
