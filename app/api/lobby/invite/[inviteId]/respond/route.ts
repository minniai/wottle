import { NextResponse } from "next/server";

import { respondChallenge } from "@/lib/matchmaking/challengeService";
import { readLobbySession } from "@/lib/matchmaking/profile";

const NO_CACHE_HEADERS = { "cache-control": "no-store" };

interface RespondParams {
  inviteId: string;
}

/** POST { status: "accepted" | "declined" }: a thin wrapper over respondChallenge (spec 070 contracts). */
export async function POST(request: Request, context: { params: Promise<RespondParams> | RespondParams }) {
  const { inviteId } = await context.params;
  const session = await readLobbySession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: NO_CACHE_HEADERS });
  const payload = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const answer = payload?.status === "accepted" ? "accept" : payload?.status === "declined" ? "decline" : null;
  if (!answer) return NextResponse.json({ error: "status must be 'accepted' or 'declined'." }, { status: 400, headers: NO_CACHE_HEADERS });
  try {
    return NextResponse.json(await respondChallenge(session.player.id, inviteId, answer), { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "respond failed" }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
