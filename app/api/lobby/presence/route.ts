import { NextResponse } from "next/server";

import { forgetPresence } from "../../../../lib/matchmaking/presenceCache";
import { readLobbySession } from "../../../../lib/matchmaking/profile";
import { expireLobbyPresence } from "../../../../lib/matchmaking/service";
import { getServiceRoleClient } from "../../../../lib/supabase/server";

export async function DELETE() {
  console.log("[DELETE /api/lobby/presence] Request received");
  try {
    const session = await readLobbySession();
    if (!session) {
      console.log("[DELETE /api/lobby/presence] No session found");
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log("[DELETE /api/lobby/presence] Deleting presence for player:", session.player.id);
    const supabase = getServiceRoleClient();
    await expireLobbyPresence(supabase, session.player.id);
    
    // Also clear from server-side cache to ensure immediate removal
    forgetPresence(session.player.id);
    
    console.log("[DELETE /api/lobby/presence] Successfully deleted presence");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete lobby presence", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete presence.",
      },
      { status: 500 }
    );
  }
}

