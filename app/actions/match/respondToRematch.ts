"use server";

import "server-only";


import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { writeMatchLog } from "@/lib/match/logWriter";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import {
  fetchRematchRequest,
  updateRematchRequestStatus,
} from "@/lib/match/rematchRepository";
import type { RematchRequest } from "@/lib/types/match";
import { acceptRematch } from "@/lib/match/createMatch";
import { announceRematch, announceRematchExpiry } from "@/lib/match/rematchAnnouncements";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const REMATCH_TIMEOUT_MS = 30_000;

interface ValidatedRematchContext {
  playerId: string;
  request: RematchRequest;
  supabase: SupabaseClient;
}

const matchIdSchema = z.string().uuid("Invalid match ID.");

async function validateAndFetchRequest(
  matchId: string,
): Promise<ValidatedRematchContext | { status: "expired" }> {
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

  const supabase = getServiceRoleClient();
  const request = await fetchRematchRequest(supabase, matchId);

  if (!request) {
    throw new Error("No rematch request found for this match.");
  }

  if (request.responderId !== playerId) {
    throw new Error(
      "You are not the responder for this rematch request.",
    );
  }

  if (request.status !== "pending") {
    throw new Error("This rematch request has already been processed.");
  }

  // Check staleness
  const elapsed =
    Date.now() - new Date(request.createdAt).getTime();
  if (elapsed > REMATCH_TIMEOUT_MS) {
    await updateRematchRequestStatus(supabase, request.id, "expired");
    await announceRematchExpiry(matchId, request.requesterId);
    return { status: "expired" };
  }

  return { playerId, request, supabase };
}

export type AcceptRematchResult =
  | { status: "accepted"; matchId: string }
  | { status: "expired" }
  /** Either player is in another match now (spec 067); nothing was created. */
  | { status: "busy" };

export async function acceptRematchAction(
  matchId: string,
): Promise<AcceptRematchResult> {
  const ctx = await validateAndFetchRequest(matchId);
  if ("status" in ctx) return ctx;

  const { playerId, request, supabase } = ctx;
  const result = await acceptRematch(supabase, { requestId: request.id, actorId: playerId });
  if (result.status === "created") {
    await announceRematch(supabase, { matchId, requesterId: request.requesterId, newMatchId: result.matchId, players: [request.requesterId, playerId] });
    return { status: "accepted", matchId: result.matchId };
  }
  if (result.status === "busy") return { status: "busy" };
  if (result.status === "expired") await announceRematchExpiry(matchId, request.requesterId);
  return { status: "expired" };
}

export type DeclineRematchResult =
  | { status: "declined" }
  | { status: "expired" };

export async function declineRematchAction(
  matchId: string,
): Promise<DeclineRematchResult> {
  const ctx = await validateAndFetchRequest(matchId);
  if ("status" in ctx) return ctx;

  const { playerId, request, supabase } = ctx;

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

/**
 * @deprecated Use acceptRematchAction or declineRematchAction instead.
 * Kept for backward compatibility with existing tests.
 */
export type RespondToRematchResult = AcceptRematchResult | DeclineRematchResult;

export async function respondToRematchAction(
  matchId: string,
  accept: boolean,
): Promise<RespondToRematchResult> {
  if (accept) {
    return acceptRematchAction(matchId);
  }
  return declineRematchAction(matchId);
}
