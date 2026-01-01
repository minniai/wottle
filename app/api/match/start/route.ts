import { NextResponse } from "next/server";

import { startAutoQueue } from "@/lib/matchmaking/inviteService";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function POST() {
  const session = await readLobbySession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = getServiceRoleClient();
    const result = await startAutoQueue(supabase, {
      playerId: session.player.id,
    });
    return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Matchmaking failed.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}


