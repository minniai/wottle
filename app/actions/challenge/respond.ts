"use server";

import "server-only";

import { z } from "zod";

import { respondChallenge, type RespondResult } from "@/lib/matchmaking/challengeService";
import { readLobbySession } from "@/lib/matchmaking/profile";

const inputSchema = z.object({ inviteId: z.string().uuid(), answer: z.enum(["accept", "decline"]) });

export type RespondChallengeActionResult = RespondResult | { status: "unauthenticated" | "error" };

/** `accept ▸` / `decline` on a call (spec 070 US4.5–US4.6). An accept goes through the one match-creation path. */
export async function respondChallengeAction(input: z.input<typeof inputSchema>): Promise<RespondChallengeActionResult> {
  const session = await readLobbySession();
  if (!session) return { status: "unauthenticated" };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };
  try {
    return await respondChallenge(session.player.id, parsed.data.inviteId, parsed.data.answer);
  } catch (error) {
    console.error(JSON.stringify({ event: "challenge.respond.failed", error: error instanceof Error ? error.message : String(error) }));
    return { status: "error" };
  }
}
