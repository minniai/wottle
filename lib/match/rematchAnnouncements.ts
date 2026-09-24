import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeMatchLog } from "@/lib/match/logWriter";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import { pokePlayers } from "@/lib/realtime/pokes";

export interface RematchCreated {
  matchId: string;
  requesterId: string;
  newMatchId: string;
  players: readonly string[];
}

/**
 * The rematch exists: log it and tell both clients it does. No broadcast
 * carries the new id; each client reads it from the old match's state route
 * (spec 070 FR-034).
 */
export async function announceRematch(supabase: SupabaseClient, { matchId, requesterId, newMatchId, players }: RematchCreated): Promise<void> {
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
  });
  await pokePlayers(players, "rematch");
}

export async function announceRematchExpiry(matchId: string, requesterId: string): Promise<void> {
  await broadcastRematchEvent(matchId, { type: "rematch-expired", matchId, requesterId, status: "expired" });
}
