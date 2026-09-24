"use server";

import "server-only";

import { writeMatchLog } from "@/lib/match/logWriter";
import { pokeBoth, rematchCaller } from "@/lib/match/rematchAction";
import { pendingRequestOf, withdrawRematch } from "@/lib/match/rematchService";

export type WithdrawRematchResult = { status: "withdrawn" | "superseded" | "refused" };

/**
 * Spec 071 (FR-012, T42): `cancel ▸`, or leaving for a new opponent or the lobby. The requester's
 * request is withdrawn; a recipient who leaves supersedes it (`started another match`). No cooldown.
 */
export async function withdrawRematchAction(matchId: string): Promise<WithdrawRematchResult> {
  const caller = await rematchCaller(matchId);
  const request = await pendingRequestOf(caller.client, matchId);
  if (!request) return { status: "refused" };
  const result = await withdrawRematch(caller.client, request.id, caller.playerId);
  if (result.status === "refused") return result;
  await writeMatchLog(caller.client, { matchId, eventType: `match.rematch.${result.status}`, actorId: caller.playerId });
  await pokeBoth(caller, matchId);
  return result;
}
