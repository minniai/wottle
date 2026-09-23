import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeMatchLog } from "@/lib/match/logWriter";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";

/** The rematch exists: log it and tell both clients where it is. */
export async function announceRematch(
  supabase: SupabaseClient,
  matchId: string,
  requesterId: string,
  newMatchId: string,
): Promise<void> {
  await writeMatchLog(supabase, {
    matchId: newMatchId,
    eventType: "match.rematch.created",
    metadata: { previousMatchId: matchId },
  });
  await broadcastRematchEvent(matchId, {
    type: "rematch-accepted",
    matchId,
    requesterId,
    status: "accepted",
    newMatchId,
  });
}

export async function announceRematchExpiry(matchId: string, requesterId: string): Promise<void> {
  await broadcastRematchEvent(matchId, { type: "rematch-expired", matchId, requesterId, status: "expired" });
}
