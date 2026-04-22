"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { writeMatchLog } from "@/lib/match/logWriter";
import {
  RECONNECT_WINDOW_MS,
  clearDisconnect,
  getDisconnectRecord,
  recordDisconnect,
} from "@/lib/match/disconnectStore";

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

  recordDisconnect(matchId, playerId);

  // Broadcast disconnect state to all clients
  await publishMatchStateWithDisconnect(matchId, playerId);

  // Schedule timeout check (in production, use a proper job queue)
  setTimeout(async () => {
    if (clearDisconnect(matchId, playerId)) {
      // Player did not reconnect within the window → finalize the match.
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

  const record = getDisconnectRecord(matchId, playerId);
  if (!record) {
    return;
  }

  const disconnectTime = new Date(record.disconnectedAt).getTime();
  const elapsed = Date.now() - disconnectTime;

  if (elapsed < RECONNECT_WINDOW_MS) {
    // Reconnected inside the window — clear state and broadcast.
    clearDisconnect(matchId, playerId);
    await publishMatchStateWithDisconnect(matchId, null);

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
    // Too late — the timeout already fired; clear to keep the store tidy.
    clearDisconnect(matchId, playerId);
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

async function finalizeMatchOnDisconnectTimeout(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
  disconnectedPlayerId: string,
): Promise<void> {
  const { completeMatchInternal } = await import("./completeMatch");

  const { data: match } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id")
    .eq("id", matchId)
    .maybeSingle();

  const nonDisconnectedId = match
    ? match.player_a_id === disconnectedPlayerId
      ? match.player_b_id
      : match.player_a_id
    : undefined;

  await completeMatchInternal(matchId, "disconnect", nonDisconnectedId);
}
