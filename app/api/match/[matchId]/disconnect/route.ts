import { NextResponse } from "next/server";

import { handlePlayerDisconnect } from "@/app/actions/match/handleDisconnect";
import { readLobbySession } from "@/lib/matchmaking/profile";

/**
 * sendBeacon-friendly disconnect endpoint. Used by MatchClient on `pagehide`
 * to reliably notify the server when the tab is being torn down — Server
 * Actions invoked from a closing tab routinely abort mid-fetch, but
 * `navigator.sendBeacon` queues the request on the browser's network thread
 * and is delivered even after the page is gone.
 *
 * Body: ignored (we identify the player from the session cookie). The endpoint
 * accepts POST so sendBeacon can deliver it; the body is whatever the browser
 * sent (typically an empty Blob).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  const { matchId } = await params;
  const session = await readLobbySession();

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    await handlePlayerDisconnect(matchId, session.player.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[api/match/disconnect] handlePlayerDisconnect failed:", error);
    return NextResponse.json(
      { error: "Failed to record disconnect." },
      { status: 500 },
    );
  }
}
