"use server";

import "server-only";

import { z } from "zod";

import {
  fetchRematchRequest,
  updateRematchRequestStatus,
} from "@/lib/match/rematchRepository";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * FR-018: Cancel a pending rematch request when the requester navigates away.
 * Fire-and-forget — errors are silently ignored on the client.
 */
const matchIdSchema = z.string().uuid("Invalid match ID.");

export async function cancelRematchAction(
  matchId: string,
): Promise<void> {
  matchIdSchema.parse(matchId);

  const session = await readLobbySession();
  if (!session) return;

  const supabase = getServiceRoleClient();
  const request = await fetchRematchRequest(supabase, matchId);

  if (!request) return;
  if (request.requesterId !== session.player.id) return;
  if (request.status !== "pending") return;

  await updateRematchRequestStatus(supabase, request.id, "expired");

  await broadcastRematchEvent(matchId, {
    type: "rematch-expired",
    matchId,
    requesterId: request.requesterId,
    status: "expired",
  });
}
