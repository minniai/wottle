import { NextResponse } from "next/server";

import { attentionFromQuery, recordAttention } from "@/lib/matchmaking/attention";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { readStanding } from "@/lib/standing/readStanding";
import { getServiceRoleClient } from "@/lib/supabase/server";

const NO_CACHE_HEADERS = { "cache-control": "no-store" };

/**
 * GET /api/standing (spec 070 R5): what the line slot can show, for the
 * signed-in viewer, read on every poke and on the fallback poll. The tab's
 * attention rides along, as it did on the table check (spec 069).
 */
export async function GET(request: Request) {
  const session = await readLobbySession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_CACHE_HEADERS });
  try {
    const attention = attentionFromQuery(new URL(request.url).searchParams);
    if (attention) await recordAttention(getServiceRoleClient(), session.player.id, attention);
    return NextResponse.json(await readStanding(session.player.id), { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error(JSON.stringify({ event: "standing.read.failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "standing failed" }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
