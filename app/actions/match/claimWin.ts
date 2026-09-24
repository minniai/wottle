"use server";

import "server-only";
import { z } from "zod";

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import {
  RECONNECT_WINDOW_MS,
  getDisconnectedAt,
} from "@/lib/match/disconnectStore";
import { readParticipants } from "@/lib/match/heartbeatRepository";
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
  /** Spec 050 FR-012: the offer is for a player who has made all their moves. */
  | { status: "not_done"; movesPlayed: number; moveLimit: number }
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

  const parsed = inputSchema.safeParse({ matchId });
  if (!parsed.success) {
    return { status: "error", message: "Invalid matchId." };
  }

  try {
    const supabase = getServiceRoleClient();
    const { data: match } = await supabase
      .from("matches")
      .select("state, player_a_id, player_b_id, player_a_moves, player_b_moves, move_limit, created_at")
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

    const movesPlayed = match.player_a_id === selfId ? (match.player_a_moves ?? 0) : (match.player_b_moves ?? 0);
    const moveLimit = match.move_limit ?? 10;
    if (movesPlayed < moveLimit) {
      return { status: "not_done", movesPlayed, moveLimit };
    }

    const disconnectedAt = await opponentGoneSince(supabase, { matchId: parsed.data.matchId, match, opponentId });
    if (disconnectedAt === null) {
      return { status: "not_disconnected" };
    }

    const elapsed = Date.now() - disconnectedAt;
    if (elapsed < RECONNECT_WINDOW_MS) {
      return {
        status: "too_early",
        remainingMs: RECONNECT_WINDOW_MS - elapsed,
      };
    }

    // Only the claim that ends the match counts against the limit: a refusal
    // changes nothing, and the client retries `too_early` once the server's
    // window has passed (its own count can run a few ms ahead).
    const limited = checkClaimRate(selfId);
    if (limited) return limited;

    // The ordinary rules decide (spec 050 FR-012): the caller has all their
    // moves and the absent opponent does not, so the caller wins `incomplete`.
    await completeMatchInternal(parsed.data.matchId, "natural");
    return { status: "ok", matchId: parsed.data.matchId };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Claim win failed.",
    };
  }
}

interface GoneQuery {
  matchId: string;
  match: { player_a_id: string; player_b_id: string; created_at: string };
  opponentId: string;
}

/**
 * When the opponent went away, read as the loader reads it (spec 070): the
 * in-memory record or a stale heartbeat, and never while they have only
 * stepped out to another page of the app.
 */
async function opponentGoneSince(client: ReturnType<typeof getServiceRoleClient>, { matchId, match, opponentId }: GoneQuery): Promise<number | null> {
  const participants = await readParticipants(client, {
    matchId,
    playerAId: match.player_a_id,
    playerBId: match.player_b_id,
    matchCreatedAt: new Date(match.created_at),
  });
  if (participants.steppedOut === opponentId) return null;
  const recorded = getDisconnectedAt(matchId, opponentId);
  if (recorded !== null) return recorded;
  return participants.stale?.playerId === opponentId ? Date.parse(participants.stale.disconnectedAt) : null;
}

function checkClaimRate(playerId: string): ClaimWinResult | null {
  try {
    assertWithinRateLimit({
      identifier: playerId,
      scope: "match:claim-win",
      limit: 1,
      windowMs: 60_000,
      errorMessage: "Slow down — you can only claim one win per minute.",
    });
    return null;
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return { status: "rate_limited", retryAfterSeconds: error.retryAfterSeconds };
    }
    throw error;
  }
}
