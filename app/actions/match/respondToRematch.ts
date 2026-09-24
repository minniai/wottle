"use server";

import "server-only";

import { acceptRematch } from "@/lib/match/createMatch";
import { writeMatchLog } from "@/lib/match/logWriter";
import { pokeBoth, rematchCaller } from "@/lib/match/rematchAction";
import { declineRematch, pendingRequestOf } from "@/lib/match/rematchService";

export type AcceptRematchResult =
  | { status: "accepted"; matchId: string }
  | { status: "expired" }
  /** Either player is at another table now; the request ends as `started another match`. */
  | { status: "busy" }
  | { status: "refused" };

/** Spec 071 (FR-015): the recipient accepts through the one match-creation path. */
export async function acceptRematchAction(matchId: string): Promise<AcceptRematchResult> {
  const caller = await rematchCaller(matchId);
  const request = await pendingRequestOf(caller.client, matchId);
  if (!request) return { status: "refused" };
  const result = await acceptRematch(caller.client, { requestId: request.id, actorId: caller.playerId });
  if (result.status === "created") {
    await writeMatchLog(caller.client, { matchId: result.matchId, eventType: "match.rematch.created", metadata: { previousMatchId: matchId } });
  }
  await pokeBoth(caller, matchId);
  if (result.status === "created") return { status: "accepted", matchId: result.matchId };
  if (result.status === "busy") return { status: "busy" };
  return { status: result.status === "expired" ? "expired" : "refused" };
}

export type DeclineRematchResult = { status: "declined" | "expired" | "refused" };

/** Spec 071 (FR-016): a decline ends the rematch for both and starts the pair's cooldown. */
export async function declineRematchAction(matchId: string): Promise<DeclineRematchResult> {
  const caller = await rematchCaller(matchId);
  const request = await pendingRequestOf(caller.client, matchId);
  if (!request) return { status: "refused" };
  const result = await declineRematch(caller.client, request.id, caller.playerId);
  if (result.status === "declined") {
    await writeMatchLog(caller.client, { matchId, eventType: "match.rematch.declined", actorId: caller.playerId });
  }
  if (result.status !== "refused") await pokeBoth(caller, matchId);
  return result;
}
