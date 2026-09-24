"use server";

import "server-only";


import { z } from "zod";

import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { writeMatchLog } from "@/lib/match/logWriter";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import { fetchRematchRequest, insertRematchRequest } from "@/lib/match/rematchRepository";
import {
  detectSimultaneousRematch,
  validateRematchRequest,
} from "@/lib/match/rematchService";
import { acceptRematch } from "@/lib/match/createMatch";
import { announceRematch } from "@/lib/match/rematchAnnouncements";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

async function fetchMatch(matchId: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id,state,ended_reason,player_a_id,player_b_id")
    .eq("id", matchId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Match not found.");
  }

  return data as {
    id: string;
    state: string;
    ended_reason: string | null;
    player_a_id: string;
    player_b_id: string;
  };
}

/** Both asked: the second request is the answer to the first (spec 067 crossed rematch). */
async function acceptCrossedRematch(matchId: string, requestId: string, requesterId: string, callerId: string): Promise<RematchResult> {
  const supabase = getServiceRoleClient();
  const result = await acceptRematch(supabase, { requestId, actorId: callerId, origin: "crossed_rematch" });
  if (result.status === "busy") return { status: "busy" };
  if (result.status !== "created") throw new Error("A rematch has already been processed for this match.");
  await announceRematch(supabase, { matchId, requesterId, newMatchId: result.matchId, players: [requesterId, callerId] });
  return { status: "accepted", matchId: result.matchId };
}

export type RematchResult =
  | { status: "pending" }
  | { status: "accepted"; matchId: string }
  /** Either player is in another match now (spec 067). */
  | { status: "busy" };

const matchIdSchema = z.string().uuid("Invalid match ID.");

export async function requestRematchAction(
  matchId: string,
): Promise<RematchResult> {
  matchIdSchema.parse(matchId);

  const session = await readLobbySession();
  if (!session) {
    throw new Error("Authentication required.");
  }

  const playerId = session.player.id;

  assertWithinRateLimit({
    identifier: playerId,
    scope: "match:rematch",
    limit: 5,
    windowMs: 60_000,
  });

  const match = await fetchMatch(matchId);
  // Spec 069 FR-016: a void table was never a match, so there is nothing to play again.
  if (match.ended_reason === "void") {
    throw new Error("A void match has no rematch.");
  }

  const opponentId =
    playerId === match.player_a_id
      ? match.player_b_id
      : match.player_a_id;

  const supabase = getServiceRoleClient();
  const existingRequest = await fetchRematchRequest(supabase, matchId);

  const validationError = validateRematchRequest(
    match.state,
    match.player_a_id,
    match.player_b_id,
    playerId,
    existingRequest,
  );

  if (validationError) {
    throw new Error(validationError);
  }

  // Simultaneous detection: opponent already requested, caller is the responder
  if (detectSimultaneousRematch(existingRequest, playerId)) {
    return acceptCrossedRematch(matchId, existingRequest!.id, existingRequest!.requesterId, playerId);
  }

  await writeMatchLog(supabase, {
    matchId,
    eventType: "match.rematch.requested",
    actorId: playerId,
  });

  const request = await insertRematchRequest(
    supabase,
    matchId,
    playerId,
    opponentId,
  );

  await broadcastRematchEvent(matchId, {
    type: "rematch-request",
    matchId,
    requesterId: playerId,
    status: "pending",
  });

  return { status: "pending" };
}
