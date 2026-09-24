import { z } from "zod";

import { withdrawChallenge } from "@/lib/matchmaking/challengeService";
import { readLobbySession } from "@/lib/matchmaking/profile";

const bodySchema = z.object({ inviteId: z.string().uuid() });

/**
 * The closing tab's beacon for its challenge (spec 070 FR-021): sent only from
 * the player's last tab, as text/plain JSON (a beacon cannot set headers).
 */
export async function POST(request: Request): Promise<Response> {
  const session = await readLobbySession();
  if (!session) return new Response(null, { status: 401 });
  const text = await request.text().catch(() => "");
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  await withdrawChallenge(session.player.id, parsed.data.inviteId).catch((error: unknown) =>
    console.error(JSON.stringify({ event: "challenge.withdraw.failed", error: error instanceof Error ? error.message : String(error) })),
  );
  return new Response(null, { status: 204 });
}
