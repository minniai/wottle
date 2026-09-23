import { NextResponse } from "next/server";

import { attentionFromQuery, recordAttention } from "@/lib/matchmaking/attention";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { findActiveMatchForPlayer } from "@/lib/matchmaking/service";
import { readTableStatus } from "@/lib/matchmaking/tableStatus";
import { getServiceRoleClient } from "@/lib/supabase/server";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

/**
 * The table check (spec 069 FR-025a): every room page asks every 3s whether a
 * table waits for the player, reporting its tab's attention as it asks. The
 * answer also carries the leave cooldown and, once, a missed table's notice.
 */
export async function GET(request: Request) {
  const session = await readLobbySession();
  if (!session) {
    return NextResponse.json({ match: null, cooldownUntil: null, notice: null }, { status: 200, headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = getServiceRoleClient();
    const playerId = session.player.id;
    const attention = attentionFromQuery(new URL(request.url).searchParams);
    if (attention) await recordAttention(supabase, playerId, attention);
    const [match, status] = await Promise.all([findActiveMatchForPlayer(supabase, playerId), readTableStatus(supabase, playerId)]);
    return NextResponse.json({ match, ...status }, { status: 200, headers: NO_CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { match: null, error: error instanceof Error ? error.message : "Unable to load match status." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
