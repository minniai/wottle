"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { writeMatchLog } from "@/lib/match/logWriter";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import {
  fetchRematchRequest,
  updateRematchRequestStatus,
} from "@/lib/match/rematchRepository";
import { bootstrapMatchRecord } from "@/lib/matchmaking/service";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const REMATCH_TIMEOUT_MS = 30_000;

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

export type RespondToRematchResult =
  | { status: "accepted"; matchId: string }
  | { status: "declined" }
  | { status: "expired" };

export async function respondToRematchAction(
  matchId: string,
  accept: boolean,
): Promise<RespondToRematchResult> {
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

  const supabase = getServiceRoleClient();
  const request = await fetchRematchRequest(supabase, matchId);

  if (!request) {
    throw new Error("No rematch request found for this match.");
  }

  if (request.responderId !== playerId) {
    throw new Error("You are not the responder for this rematch request.");
  }

  if (request.status !== "pending") {
    throw new Error("This rematch request has already been processed.");
  }

  // Check staleness
  const elapsed = Date.now() - new Date(request.createdAt).getTime();
  if (elapsed > REMATCH_TIMEOUT_MS) {
    await updateRematchRequestStatus(supabase, request.id, "expired");

    await broadcastRematchEvent(matchId, {
      type: "rematch-expired",
      matchId,
      requesterId: request.requesterId,
      status: "expired",
    });

    return { status: "expired" };
  }

  if (!accept) {
    await updateRematchRequestStatus(supabase, request.id, "declined");

    await writeMatchLog(supabase, {
      matchId,
      eventType: "match.rematch.declined",
      actorId: playerId,
    });

    await broadcastRematchEvent(matchId, {
      type: "rematch-declined",
      matchId,
      requesterId: request.requesterId,
      status: "declined",
    });

    return { status: "declined" };
  }

  // Accept: create new match
  const newMatchId = await bootstrapMatchRecord(supabase, {
    boardSeed: randomUUID(),
    playerAId: request.requesterId,
    playerBId: request.responderId,
    rematchOf: matchId,
  });

  await updateRematchRequestStatus(
    supabase,
    request.id,
    "accepted",
    newMatchId,
  );

  await setPlayersInMatch([request.requesterId, request.responderId]);

  await writeMatchLog(supabase, {
    matchId: newMatchId,
    eventType: "match.rematch.created",
    metadata: { previousMatchId: matchId },
  });

  await broadcastRematchEvent(matchId, {
    type: "rematch-accepted",
    matchId,
    requesterId: request.requesterId,
    status: "accepted",
    newMatchId,
  });

  return { status: "accepted", matchId: newMatchId };
}
