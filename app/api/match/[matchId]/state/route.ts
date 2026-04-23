import { NextResponse } from "next/server";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { loadMatchState } from "@/lib/match/stateLoader";
import { getServiceRoleClient } from "@/lib/supabase/server";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function GET(
  _request: Request,
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
  const state = await loadMatchState(supabase, matchId);

  if (!state) {
    return NextResponse.json(
      { error: "Match not found." },
      { status: 404, headers: NO_CACHE_HEADERS },
    );
  }

  const playerId = session.player.id;
  const isParticipant =
    playerId === state.timers.playerA.playerId ||
    playerId === state.timers.playerB.playerId;

  if (!isParticipant) {
    return NextResponse.json(
      { error: "You are not a participant in this match." },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  return NextResponse.json(state, { status: 200, headers: NO_CACHE_HEADERS });
}

