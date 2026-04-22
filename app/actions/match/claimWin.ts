"use server";

import "server-only";
import { z } from "zod";

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import {
  RECONNECT_WINDOW_MS_EXPORT,
  getDisconnectedAt,
} from "@/app/actions/match/handleDisconnect";
import { readLobbySession } from "@/lib/matchmaking/profile";
import {
  assertWithinRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";

export type ClaimWinResult =
  | { status: "ok"; matchId: string }
  | { status: "too_early"; remainingMs: number }
  | { status: "not_disconnected" }
  | { status: "already_completed"; matchId: string }
  | { status: "forbidden" }
  | { status: "unauthenticated" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "error"; message: string };

const inputSchema = z.object({ matchId: z.string().uuid() });

export async function claimWinAction(
  matchId: string,
): Promise<ClaimWinResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated" };
  }

  try {
    assertWithinRateLimit({
      identifier: session.player.id,
      scope: "match:claim-win",
      limit: 1,
      windowMs: 60_000,
      errorMessage: "Slow down — you can only claim one win per minute.",
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        status: "rate_limited",
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
    throw error;
  }

  const parsed = inputSchema.safeParse({ matchId });
  if (!parsed.success) {
    return { status: "error", message: "Invalid matchId." };
  }

  try {
    const supabase = getServiceRoleClient();
    const { data: match } = await supabase
      .from("matches")
      .select("state, player_a_id, player_b_id")
      .eq("id", parsed.data.matchId)
      .maybeSingle();

    if (!match) {
      return { status: "error", message: "Match not found." };
    }

    if (match.state === "completed") {
      return { status: "already_completed", matchId: parsed.data.matchId };
    }

    const selfId = session.player.id;
    if (match.player_a_id !== selfId && match.player_b_id !== selfId) {
      return { status: "forbidden" };
    }

    const opponentId =
      match.player_a_id === selfId ? match.player_b_id : match.player_a_id;

    const disconnectedAt = getDisconnectedAt(parsed.data.matchId, opponentId);
    if (disconnectedAt === null) {
      return { status: "not_disconnected" };
    }

    const elapsed = Date.now() - disconnectedAt;
    if (elapsed < RECONNECT_WINDOW_MS_EXPORT) {
      return {
        status: "too_early",
        remainingMs: RECONNECT_WINDOW_MS_EXPORT - elapsed,
      };
    }

    await completeMatchInternal(parsed.data.matchId, "disconnect", selfId);
    return { status: "ok", matchId: parsed.data.matchId };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Claim win failed.",
    };
  }
}
