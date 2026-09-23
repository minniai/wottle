import { NextResponse } from "next/server";

import { HEARTBEAT_HIDDEN_MS, HEARTBEAT_VISIBLE_MS } from "@/lib/presence/constants";
import { beat, beatInputSchema } from "@/lib/presence/presenceService";
import { readLobbySession } from "@/lib/matchmaking/profile";

/**
 * A tab's heartbeat (spec 070 US6, contract routes-and-actions): every 10s
 * while visible, every 30s while hidden. Answers with the cadence to keep.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await readLobbySession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = beatInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid beat" }, { status: 400 });
  try {
    await beat(session.player.id, parsed.data);
    return NextResponse.json({
      cadenceMs: parsed.data.visible ? HEARTBEAT_VISIBLE_MS : HEARTBEAT_HIDDEN_MS,
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "presence.beat.failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "beat failed" }, { status: 500 });
  }
}
