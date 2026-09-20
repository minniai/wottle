"use server";

import "server-only";

import { completeMatchInternal } from "./completeMatch";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";

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

  // Persist ratings and publish the final state through the shared completion path.
  await completeMatchInternal(matchId, "forfeit", winnerId);

  return {
    matchId,
    winnerId,
    resigned: true,
  };
}
