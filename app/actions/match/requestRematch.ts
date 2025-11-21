"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { assertRematchAllowed } from "@/lib/match/resultCalculator";
import { writeMatchLog } from "@/lib/match/logWriter";
import { bootstrapMatchRecord } from "@/lib/matchmaking/service";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

async function fetchMatch(matchId: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id,state,player_a_id,player_b_id")
    .eq("id", matchId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Match not found.");
  }

  return data as {
    id: string;
    state: string;
    player_a_id: string;
    player_b_id: string;
  };
}

async function setPlayersInMatch(playerIds: string[]) {
  const supabase = getServiceRoleClient();
  await supabase
    .from("players")
    .update({
      status: "in_match",
      last_seen_at: new Date().toISOString(),
    })
    .in("id", playerIds);

  await supabase
    .from("lobby_presence")
    .update({
      mode: "auto",
      invite_token: null,
      updated_at: new Date().toISOString(),
    })
    .in("player_id", playerIds);
}

export interface RematchResult {
  matchId: string;
}

export async function requestRematchAction(matchId: string): Promise<RematchResult> {
  const session = await readLobbySession();
  if (!session) {
    throw new Error("Authentication required.");
  }

  const match = await fetchMatch(matchId);
  assertRematchAllowed(
    {
      state: match.state,
      playerAId: match.player_a_id,
      playerBId: match.player_b_id,
    },
    session.player.id,
  );

  const opponentId =
    session.player.id === match.player_a_id
      ? match.player_b_id
      : match.player_a_id;

  const supabase = getServiceRoleClient();
  await writeMatchLog(supabase, {
    matchId,
    eventType: "match.rematch.requested",
    actorId: session.player.id,
  });

  const newMatchId = await bootstrapMatchRecord(supabase, {
    boardSeed: randomUUID(),
    playerAId: session.player.id,
    playerBId: opponentId,
  });

  await setPlayersInMatch([session.player.id, opponentId]);

  await writeMatchLog(supabase, {
    matchId: newMatchId,
    eventType: "match.rematch.created",
    metadata: { previousMatchId: matchId },
  });

  return { matchId: newMatchId };
}

