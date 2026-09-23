import { NextResponse } from "next/server";

import { attentionFromQuery, recordAttention } from "@/lib/matchmaking/attention";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { loadMatchState } from "@/lib/match/stateLoader";
import { recordHeartbeat } from "@/lib/match/heartbeatRepository";
import { getServiceRoleClient } from "@/lib/supabase/server";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const session = await readLobbySession();

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  const supabase = getServiceRoleClient();
  const playerId = session.player.id;
  const state = await loadMatchState(supabase, matchId);

  if (!state) {
    return NextResponse.json(
      { error: "Match not found." },
      { status: 404, headers: NO_CACHE_HEADERS },
    );
  }

  const isParticipant =
    playerId === state.players.playerA.playerId ||
    playerId === state.players.playerB.playerId;

  if (!isParticipant) {
    return NextResponse.json(
      { error: "You are not a participant in this match." },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  // Record the caller's liveness heartbeat on every poll (issue #164).
  // Fire-and-forget so the state response doesn't wait on the upsert;
  // recordHeartbeat swallows errors and logs them.
  void recordHeartbeat(supabase, matchId, playerId);
  // Spec 069 R5: the match room reports its tab's attention too, so a player on
  // the result screen can be seated by attention at a rematch's table.
  const attention = attentionFromQuery(new URL(request.url).searchParams);
  if (attention) void recordAttention(supabase, playerId, attention);

  return NextResponse.json(state, { status: 200, headers: NO_CACHE_HEADERS });
}
