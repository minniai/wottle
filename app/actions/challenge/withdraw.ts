"use server";

import "server-only";

import { z } from "zod";

import { withdrawChallenge } from "@/lib/matchmaking/challengeService";
import { readLobbySession } from "@/lib/matchmaking/profile";

const inputSchema = z.object({ inviteId: z.string().uuid() });

export type WithdrawChallengeActionResult = { status: "withdrawn" | "not_pending" | "unauthenticated" | "error" };

/** `withdraw ▸` (spec 070 US3.3): the challenge ends, and its recipient hears of it. */
export async function withdrawChallengeAction(input: z.input<typeof inputSchema>): Promise<WithdrawChallengeActionResult> {
  const session = await readLobbySession();
  if (!session) return { status: "unauthenticated" };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };
  try {
    return await withdrawChallenge(session.player.id, parsed.data.inviteId);
  } catch (error) {
    console.error(JSON.stringify({ event: "challenge.withdraw.failed", error: error instanceof Error ? error.message : String(error) }));
    return { status: "error" };
  }
}
