import { NextResponse } from "next/server";

import { readLobbySession } from "../../../../lib/matchmaking/profile";
import { findActiveMatchForPlayer } from "../../../../lib/matchmaking/service";
import { getServiceRoleClient } from "../../../../lib/supabase/server";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function GET() {
  const session = await readLobbySession();
  if (!session) {
    return NextResponse.json(
      { match: null },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = getServiceRoleClient();
    const match = await findActiveMatchForPlayer(supabase, session.player.id);
    return NextResponse.json(
      { match },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        match: null,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load match status.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}


