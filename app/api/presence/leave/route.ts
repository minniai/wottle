import { z } from "zod";

import { leave } from "@/lib/presence/presenceService";
import { readLobbySession } from "@/lib/matchmaking/profile";

const bodySchema = z.object({ tabId: z.string().uuid() });

/**
 * The `pagehide` beacon (spec 070 US6.3): the tab is leaving. A beacon cannot
 * set headers, so the body arrives as text/plain JSON. Unless the same session
 * beats again within 8s, the tab is gone.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await readLobbySession();
  if (!session) return new Response(null, { status: 401 });
  const text = await request.text().catch(() => "");
  const parsed = bodySchema.safeParse((() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })());
  if (!parsed.success) return new Response(null, { status: 400 });
  await leave(session.player.id, parsed.data.tabId).catch((error: unknown) =>
    console.error(JSON.stringify({ event: "presence.leave.failed", error: error instanceof Error ? error.message : String(error) })),
  );
  return new Response(null, { status: 204 });
}
