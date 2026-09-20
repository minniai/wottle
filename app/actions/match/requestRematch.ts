"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { writeMatchLog } from "@/lib/match/logWriter";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import {
  fetchRematchRequest,
  insertRematchRequest,
  updateRematchRequestStatus,
} from "@/lib/match/rematchRepository";
import {
  detectSimultaneousRematch,
  validateRematchRequest,
} from "@/lib/match/rematchService";
import { bootstrapMatchRecord } from "@/lib/matchmaking/service";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

async function fetchMatch(matchId: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id,state,player_a_id,player_b_id")
    .eq("id", matchId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Match not found.");
  }

  return data as {
    id: string;
    state: string;
    player_a_id: string;
    player_b_id: string;
  };
}

async function setPlayersInMatch(playerIds: string[]) {
  const supabase = getServiceRoleClient();
  await supabase
    .from("players")
    .update({
      status: "in_match",
      last_seen_at: new Date().toISOString(),
    })
    .in("id", playerIds);

  await supabase
    .from("lobby_presence")
    .update({
      mode: "auto",
      invite_token: null,
      updated_at: new Date().toISOString(),
    })
    .in("player_id", playerIds);
}

async function acceptRematchInternal(
  matchId: string,
  requestId: string,
  playerAId: string,
  playerBId: string,
): Promise<string> {
  const supabase = getServiceRoleClient();

  const newMatchId = await bootstrapMatchRecord(supabase, {
    boardSeed: randomUUID(),
    playerAId,
    playerBId,
    rematchOf: matchId,
  });

  await updateRematchRequestStatus(supabase, requestId, "accepted", newMatchId);
  await setPlayersInMatch([playerAId, playerBId]);

  await writeMatchLog(supabase, {
    matchId: newMatchId,
    eventType: "match.rematch.created",
    metadata: { previousMatchId: matchId },
  });

  await broadcastRematchEvent(matchId, {
    type: "rematch-accepted",
    matchId,
    requesterId: playerAId,
    status: "accepted",
    newMatchId,
  });

  return newMatchId;
}

export type RematchResult =
  | { status: "pending" }
  | { status: "accepted"; matchId: string };

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
    const newMatchId = await acceptRematchInternal(
      matchId,
      existingRequest!.id,
      existingRequest!.requesterId,
      playerId,
    );
    return { status: "accepted", matchId: newMatchId };
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
