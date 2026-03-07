"use server";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { advanceRound } from "@/lib/match/roundEngine";

/**
 * Trigger a server-side timeout check for a match.
 *
 * Called by the client when it detects both players' clocks have
 * expired (dual timeout). The client cannot complete the match
 * directly — it asks the server to run advanceRound(), which
 * contains the "both-flagged" check that ends the match.
 */
export async function triggerTimeoutCheck(
  matchId: string,
): Promise<{ status: "ok" | "rejected"; error?: string }> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "rejected", error: "Not authenticated" };
  }

  try {
    await advanceRound(matchId);
  } catch {
    // Best effort — advanceRound may throw if match already completed
  }

  return { status: "ok" };
}
