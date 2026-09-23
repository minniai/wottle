import { NextResponse } from "next/server";

import { lobbyRows } from "@/lib/lobby/lobbyRows";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { lobbyLanguageSchema } from "@/lib/types/standing";

const NO_CACHE_HEADERS = { "cache-control": "no-store" };

/**
 * GET /api/lobby/players?language= (spec 070 US2): who is here in this lobby,
 * for the signed-in viewer, with their record against each. Re-read on a
 * `lobby:{language}` poke and on the fallback poll.
 */
export async function GET(request: Request) {
  const session = await readLobbySession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_CACHE_HEADERS });
  const parsed = lobbyLanguageSchema.safeParse(new URL(request.url).searchParams.get("language") ?? "is");
  if (!parsed.success) return NextResponse.json({ error: "Unknown language" }, { status: 400, headers: NO_CACHE_HEADERS });
  try {
    const rows = await lobbyRows(session.player.id, parsed.data);
    return NextResponse.json({ rows }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error(JSON.stringify({ event: "lobby.players.failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "players failed" }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
