import "server-only";
import { z } from "zod";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit, RateLimitExceededError } from "@/lib/rate-limiting/middleware";

/** What stands before every table action (spec 069): a session, a real id, the table's rate limit. */
export type TableRefusal = { status: "unauthenticated" } | { status: "invalid" } | { status: "rate_limited"; retryAfterSeconds: number };

const matchIdSchema = z.string().uuid();

/** Sitting down and leaving share one limit: 20 a minute per player. */
const TABLE_RATE = { scope: "matchmaking:table", limit: 20, windowMs: 60_000 } as const;

export async function guardTableAction(matchId: string): Promise<{ playerId: string } | TableRefusal> {
  const session = await readLobbySession();
  if (!session) return { status: "unauthenticated" };
  if (!matchIdSchema.safeParse(matchId).success) return { status: "invalid" };
  try {
    assertWithinRateLimit({ identifier: session.player.id, ...TABLE_RATE });
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { status: "rate_limited", retryAfterSeconds: error.retryAfterSeconds };
    throw error;
  }
  return { playerId: session.player.id };
}
