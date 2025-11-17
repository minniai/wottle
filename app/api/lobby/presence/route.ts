import { NextResponse } from "next/server";

import { readLobbySession } from "../../../../lib/matchmaking/profile";
import { expireLobbyPresence } from "../../../../lib/matchmaking/service";
import { getServiceRoleClient } from "../../../../lib/supabase/server";

export async function DELETE() {
  try {
    const session = await readLobbySession();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();
    await expireLobbyPresence(supabase, session.player.id);

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

