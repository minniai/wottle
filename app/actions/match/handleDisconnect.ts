"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { writeMatchLog } from "@/lib/match/logWriter";

const RECONNECT_WINDOW_MS = 10_000; // 10 seconds fixed constant per FR-012

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

  // Pause both players' timers (server-side)
  await pauseMatchTimers(supabase, matchId);

  // Broadcast disconnect state to all clients
  await publishMatchStateWithDisconnect(matchId, playerId);

  // Schedule timeout check (in production, use a proper job queue)
  setTimeout(async () => {
    const record = disconnectStore.get(disconnectKey);
    if (record) {
      // Player did not reconnect within 10 seconds
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
      // Player reconnected within window - resume timers
      disconnectStore.delete(disconnectKey);
      await resumeMatchTimers(supabase, matchId);
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

async function pauseMatchTimers(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
): Promise<void> {
  // Update match to indicate timers are paused
  // In a full implementation, we'd have a paused_timers_at field
  // For now, we'll track this via the state or a separate field
  await supabase
    .from("matches")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
}

async function resumeMatchTimers(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
): Promise<void> {
  // Resume timers - update match state
  await supabase
    .from("matches")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
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

  // Update timer status to paused if there's a disconnected player
  if (disconnectedPlayerId) {
    const timers = { ...state.timers };
    if (timers.playerA.playerId === disconnectedPlayerId) {
      timers.playerA = { ...timers.playerA, status: "paused" };
    }
    if (timers.playerB.playerId === disconnectedPlayerId) {
      timers.playerB = { ...timers.playerB, status: "paused" };
    }
    // Pause both timers when any player disconnects
    timers.playerA = { ...timers.playerA, status: "paused" };
    timers.playerB = { ...timers.playerB, status: "paused" };

    return {
      ...state,
      timers,
      disconnectedPlayerId,
    };
  }

  return {
    ...state,
    disconnectedPlayerId: null,
  };
}

async function finalizeMatchOnDisconnectTimeout(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
  disconnectedPlayerId: string,
): Promise<void> {
  const { completeMatchInternal } = await import("./completeMatch");
  await completeMatchInternal(matchId, "disconnect");
}
