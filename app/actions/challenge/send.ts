"use server";

import "server-only";

import { z } from "zod";

import { sendChallenge, type SendResult } from "@/lib/matchmaking/challengeService";
import { readLobbySession } from "@/lib/matchmaking/profile";

const inputSchema = z.object({ recipientId: z.string().uuid() });

export type SendChallengeActionResult = SendResult | { status: "unauthenticated" | "error" };

/** `send challenge ▸` (spec 070 US3). The database decides every gate; the recipient is poked. */
export async function sendChallengeAction(input: z.input<typeof inputSchema>): Promise<SendChallengeActionResult> {
  const session = await readLobbySession();
  if (!session) return { status: "unauthenticated" };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };
  try {
    return await sendChallenge(session.player.id, parsed.data.recipientId);
  } catch (error) {
    console.error(JSON.stringify({ event: "challenge.send.failed", error: error instanceof Error ? error.message : String(error) }));
    return { status: "error" };
  }
}
