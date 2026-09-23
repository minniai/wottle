import { NextResponse } from "next/server";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { publicOverview, viewerOverview } from "@/lib/lobby/overview";
import { lobbyLanguageSchema } from "@/lib/types/standing";

/**
 * GET /api/lobby/overview?language= (spec 070 S10). Public: counts and, signed
 * out, the door's here-now names. With a session: the viewer's last match and
 * last ten instead of the names.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = lobbyLanguageSchema.safeParse(new URL(request.url).searchParams.get("language") ?? "is");
  if (!parsed.success) return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  try {
    const session = await readLobbySession();
    const overview = session ? await viewerOverview(session.player.id, parsed.data) : await publicOverview(parsed.data);
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "lobby.overview.failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "overview failed" }, { status: 500 });
  }
}
