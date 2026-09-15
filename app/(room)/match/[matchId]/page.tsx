import { redirect } from "next/navigation";

import { MatchRoomController } from "@/components/room/MatchRoomController";
import { handlePlayerReconnect } from "@/app/actions/match/handleDisconnect";
import { loadMatchState, loadMatchPlayerProfiles } from "@/lib/match/stateLoader";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

interface MatchPageParams {
  matchId: string;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<MatchPageParams> | MatchPageParams;
}) {
  const { matchId } = await params;
  const session = await readLobbySession();

  if (!session) {
    redirect("/");
  }

  const supabase = getServiceRoleClient();
  
  // Attempt to handle reconnection if player was previously disconnected
  try {
    await handlePlayerReconnect(matchId, session.player.id);
  } catch (error) {
    // Log but don't fail - reconnection handling is best-effort
    console.warn("[MatchPage] Reconnection handling failed:", error);
  }

  const matchState = await loadMatchState(supabase, matchId);

  // Nothing renders outside the room: a missing match is a lobby notice, not a
  // page of its own (spec 045 FR-017). The id travels with the notice: the lobby
  // polls for an active match and would otherwise send us straight back here,
  // and a match that fails to load fails to load every time — an endless loop.
  if (!matchState) {
    redirect(`/lobby?notice=no-match&match=${encodeURIComponent(matchId)}`);
  }

  // FR-043a: a signed-in non-participant may view a completed match read-only;
  // a live match sends them back to the lobby.
  const participants = [matchState.timers.playerA.playerId, matchState.timers.playerB.playerId];
  if (!participants.includes(session.player.id) && matchState.state !== "completed" && matchState.state !== "abandoned") {
    redirect("/lobby");
  }

  const playerProfiles = await loadMatchPlayerProfiles(
    supabase,
    matchState.timers.playerA.playerId,
    matchState.timers.playerB.playerId,
  );

  return (
    <MatchRoomController
      currentPlayerId={session.player.id}
      initialState={matchState}
      matchId={matchId}
      playerProfiles={playerProfiles}
    />
  );
}


