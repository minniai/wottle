"use server";

import { settleMatchIfDue, type SettlementOutcome } from "@/lib/match/matchSettlement";
import { readLobbySession } from "@/lib/matchmaking/profile";

/**
 * The client's nudge at 0:00 (spec 050, contracts/settlement.md). The server
 * decides whether the match is due; the client cannot complete it directly.
 */
export async function settleMatch(
  matchId: string,
): Promise<{ status: "ok"; outcome: SettlementOutcome } | { status: "rejected"; error: string }> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "rejected", error: "Not authenticated" };
  }
  try {
    return { status: "ok", outcome: await settleMatchIfDue(matchId) };
  } catch (error) {
    return { status: "rejected", error: error instanceof Error ? error.message : "settlement failed" };
  }
}
