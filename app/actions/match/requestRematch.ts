"use server";

import "server-only";

import { writeMatchLog } from "@/lib/match/logWriter";
import { pokeBoth, rematchCaller } from "@/lib/match/rematchAction";
import { requestRematch } from "@/lib/match/rematchService";
import type { RematchRefusal } from "@/lib/types/match";

export type RematchResult =
  | { status: "sent"; expiresAt: string }
  /** The other player had asked too: the new match exists. */
  | { status: "accepted"; matchId: string }
  | { status: "refused"; reason: RematchRefusal };

/** Spec 071 (FR-010–FR-012): one request per match, decided by `request_rematch`. */
export async function requestRematchAction(matchId: string): Promise<RematchResult> {
  const caller = await rematchCaller(matchId);
  const result = await requestRematch(caller.client, matchId, caller.playerId);
  if (result.status === "refused") return result;
  await writeMatchLog(caller.client, {
    matchId,
    eventType: result.status === "sent" ? "match.rematch.requested" : "match.rematch.accepted",
    actorId: caller.playerId,
  });
  await pokeBoth(caller, matchId);
  return result.status === "sent" ? { status: "sent", expiresAt: result.expiresAt } : { status: "accepted", matchId: result.newMatchId };
}
