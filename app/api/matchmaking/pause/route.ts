import { NextResponse } from "next/server";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * A searching tab that goes hidden sends this beacon (spec 069 FR-021): the
 * search pauses at once, before a throttled background poll could say so. Only
 * a player who is searching is touched; the join time is kept for `resume ▸`.
 */
export async function POST(): Promise<Response> {
  const session = await readLobbySession();
  if (!session) return new NextResponse(null, { status: 401 });
  const { error } = await getServiceRoleClient()
    .from("players")
    .update({ search_paused: true })
    .eq("id", session.player.id)
    .eq("status", "matchmaking");
  if (error) console.warn(JSON.stringify({ event: "queue.pause_failed", playerId: session.player.id, error: error.message }));
  return new NextResponse(null, { status: 204 });
}
