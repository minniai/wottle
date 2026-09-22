import { NextResponse } from "next/server";

import { forgetPresence, rememberPresence } from "@/lib/matchmaking/presenceCache";
import { readLobbySession } from "@/lib/matchmaking/profile";
import {
  expireLobbyPresence,
  upsertLobbyPresence,
} from "@/lib/matchmaking/service";
import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import { getServiceRoleClient } from "@/lib/supabase/server";

const PRESENCE_TTL_SECONDS = Number(
  process.env.PLAYTEST_PRESENCE_TTL_SECONDS ?? "300",
);

/**
 * Heartbeat endpoint. Every connected client POSTs here on an interval so
 * `lobby_presence.expires_at` keeps rolling forward and the snapshot query
 * continues to include the player. Without this, the presence row written at
 * login expires after PRESENCE_TTL_SECONDS and the player silently vanishes
 * from `/api/lobby/players`.
 */
export async function POST(request?: Request) {
  try {
    // The lobby the page is in (spec 060); an old client that sends no body stays in the Icelandic one.
    const body = (await request?.json().catch(() => null)) as { language?: unknown } | null;
    const parsed = playableLanguageSchema.safeParse(body?.language ?? undefined);
    const language = parsed.success ? parsed.data : "is";
    const session = await readLobbySession();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const supabase = getServiceRoleClient();
    const expiresAt = new Date(Date.now() + PRESENCE_TTL_SECONDS * 1_000);

    await upsertLobbyPresence(supabase, {
      playerId: session.player.id,
      connectionId: crypto.randomUUID(),
      mode: "auto",
      inviteToken: null,
      expiresAt,
      language,
    });

    // Mirror the fresh presence into the server-side cache so short-lived
    // snapshot reads stay consistent between heartbeats.
    rememberPresence(session.player, language);

    return NextResponse.json({
      ok: true,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to refresh lobby presence", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh presence.",
      },
      { status: 500 },
    );
  }
}

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

