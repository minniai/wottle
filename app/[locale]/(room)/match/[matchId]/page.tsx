import { redirect } from "next/navigation";

import { MatchRoomController } from "@/components/room/MatchRoomController";
import { handlePlayerReconnect } from "@/app/actions/match/handleDisconnect";
import { loadMatchState, loadMatchPlayerProfiles } from "@/lib/match/stateLoader";
import { getLocale, localeForLanguage, localePath } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

interface MatchPageParams {
  matchId: string;
  locale?: string;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<MatchPageParams> | MatchPageParams;
}) {
  const resolved = await params;
  const { matchId } = resolved;
  const locale = await readLocaleParam(resolved);
  const session = await readLobbySession();

  if (!session) {
    redirect(localePath(locale, "/"));
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
    redirect(localePath(locale, `/lobby?notice=no-match&match=${encodeURIComponent(matchId)}`));
  }

  // Spec 060 FR-015: the page speaks the match's language, so the words on the
  // board and the words around it agree.
  if (matchState.language !== getLocale(locale).language) {
    redirect(localePath(localeForLanguage(matchState.language), `/match/${matchId}`));
  }

  // FR-043a: a signed-in non-participant may view a completed match read-only;
  // a live match sends them back to the lobby.
  const participants = [matchState.players.playerA.playerId, matchState.players.playerB.playerId];
  if (!participants.includes(session.player.id) && matchState.state !== "completed" && matchState.state !== "abandoned") {
    redirect(localePath(locale, "/lobby"));
  }

  const playerProfiles = await loadMatchPlayerProfiles(
    supabase,
    matchState.players.playerA.playerId,
    matchState.players.playerB.playerId,
    matchState.language,
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


