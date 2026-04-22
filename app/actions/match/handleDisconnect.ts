"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { writeMatchLog } from "@/lib/match/logWriter";

const RECONNECT_WINDOW_MS = 90_000; // 90 seconds per Phase 6 disconnect-modal spec

interface DisconnectRecord {
  matchId: string;
  playerId: string;
  disconnectedAt: string;
}

// In-memory store for tracking disconnects (in production, use Redis or database)
const disconnectStore = new Map<string, DisconnectRecord>();

export async function handlePlayerDisconnect(matchId: string, playerId: string): Promise<void> {
  const session = await readLobbySession();
  if (!session) {
    throw new Error("Authentication required.");
  }

  const supabase = getServiceRoleClient();

  // Verify the player is in this match
  const { data: match } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, state")
    .eq("id", matchId)
    .single();

  if (!match) {
    throw new Error("Match not found.");
  }

  const isParticipant =
    match.player_a_id === playerId || match.player_b_id === playerId;
  if (!isParticipant) {
    throw new Error("Player is not a participant in this match.");
  }

  if (match.state !== "in_progress") {
    // Match already completed/abandoned, no need to handle disconnect
    return;
  }

  // Record disconnect time
  const disconnectKey = `${matchId}:${playerId}`;
  disconnectStore.set(disconnectKey, {
    matchId,
    playerId,
    disconnectedAt: new Date().toISOString(),
  });

  // Broadcast disconnect state to all clients
  await publishMatchStateWithDisconnect(matchId, playerId);

  // Schedule timeout check (in production, use a proper job queue)
  setTimeout(async () => {
    const record = disconnectStore.get(disconnectKey);
    if (record) {
      // Player did not reconnect within 90 seconds
      disconnectStore.delete(disconnectKey);
      await finalizeMatchOnDisconnectTimeout(supabase, matchId, playerId);
    }
  }, RECONNECT_WINDOW_MS);

  await writeMatchLog(supabase, {
    matchId,
    eventType: "disconnect",
    metadata: {
      playerId,
      disconnectedAt: new Date().toISOString(),
    },
  });
}

export async function handlePlayerReconnect(matchId: string, playerId: string): Promise<void> {
  const session = await readLobbySession();
  if (!session) {
    throw new Error("Authentication required.");
  }

  const supabase = getServiceRoleClient();

  // Verify the player is in this match
  const { data: match } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, state")
    .eq("id", matchId)
    .single();

  if (!match) {
    throw new Error("Match not found.");
  }

  const isParticipant =
    match.player_a_id === playerId || match.player_b_id === playerId;
  if (!isParticipant) {
    throw new Error("Player is not a participant in this match.");
  }

  if (match.state !== "in_progress") {
    return;
  }

  // Check if player was disconnected
  const disconnectKey = `${matchId}:${playerId}`;
  const record = disconnectStore.get(disconnectKey);

  if (record) {
    const disconnectTime = new Date(record.disconnectedAt).getTime();
    const now = Date.now();
    const elapsed = now - disconnectTime;

    if (elapsed < RECONNECT_WINDOW_MS) {
      // Player reconnected within window - clear disconnect state
      disconnectStore.delete(disconnectKey);
      await publishMatchStateWithDisconnect(matchId, null); // Clear disconnect state

      await writeMatchLog(supabase, {
        matchId,
        eventType: "reconnect",
        metadata: {
          playerId,
          reconnectedAt: new Date().toISOString(),
          elapsedMs: elapsed,
        },
      });
    } else {
      // Too late - match already finalized
      disconnectStore.delete(disconnectKey);
    }
  }
}

async function publishMatchStateWithDisconnect(
  matchId: string,
  disconnectedPlayerId: string | null,
): Promise<void> {
  const supabase = getServiceRoleClient();
  const state = await loadMatchStateWithDisconnect(supabase, matchId, disconnectedPlayerId);
  if (!state) {
    return;
  }

  const channel = supabase.channel(`match:${matchId}`);
  await channel.send({
    type: "broadcast",
    event: "state",
    payload: state,
  });
}

async function loadMatchStateWithDisconnect(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
  disconnectedPlayerId: string | null,
) {
  const { loadMatchState } = await import("@/lib/match/stateLoader");
  const state = await loadMatchState(supabase, matchId);
  if (!state) {
    return null;
  }

  if (disconnectedPlayerId) {
    return {
      ...state,
      disconnectedPlayerId,
    };
  }

  return {
    ...state,
    disconnectedPlayerId: null,
  };
}

/**
 * Returns the timestamp (ms since epoch) when the player first lost their
 * connection for this match, or null if they are currently connected.
 *
 * Used by claimWinAction to check whether the 90s window has elapsed.
 */
export function getDisconnectedAt(
  matchId: string,
  playerId: string,
): number | null {
  const key = `${matchId}:${playerId}`;
  const record = disconnectStore.get(key);
  if (!record) return null;
  return new Date(record.disconnectedAt).getTime();
}

export const RECONNECT_WINDOW_MS_EXPORT = RECONNECT_WINDOW_MS;

async function finalizeMatchOnDisconnectTimeout(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
  disconnectedPlayerId: string,
): Promise<void> {
  const { completeMatchInternal } = await import("./completeMatch");
  await completeMatchInternal(matchId, "disconnect");
}
