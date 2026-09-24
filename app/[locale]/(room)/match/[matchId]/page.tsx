import { redirect } from "next/navigation";

import { MatchRoomController } from "@/components/room/MatchRoomController";
import { handlePlayerReconnect } from "@/app/actions/match/handleDisconnect";
import { loadMatchState, loadMatchPlayerProfiles } from "@/lib/match/stateLoader";
import { localePath } from "@/lib/i18n/locales";
import { readLocaleParam } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readRematchOffer } from "@/lib/match/rematchOffer";
import { matchPageAccess } from "@/lib/room/matchPageAccess";

interface MatchPageParams {
  matchId: string;
  locale?: string;
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<MatchPageParams> | MatchPageParams;
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolved = await params;
  const { matchId } = resolved;
  const locale = await readLocaleParam(resolved);
  const search = queryOf((await searchParams) ?? {});
  const session = await readLobbySession();
  const supabase = getServiceRoleClient();

  if (session) {
    // Attempt to handle reconnection if player was previously disconnected; best-effort.
    try {
      await handlePlayerReconnect(matchId, session.player.id);
    } catch (error) {
      console.warn("[MatchPage] Reconnection handling failed:", error);
    }
  }

  const matchState = await loadMatchState(supabase, matchId);
  const participants = matchState ? [matchState.players.playerA.playerId, matchState.players.playerB.playerId] : [];
  const participant = session ? participants.includes(session.player.id) : false;

  // Spec 071 (FR-042): a finished match is readable by anyone; a missing match is a lobby notice
  // (spec 045 FR-017); the page speaks the match's language (spec 060 FR-015); a void table was
  // never a match (spec 069). Every redirect keeps the query, so `?review=n` survives it.
  const access = matchPageAccess({
    locale,
    matchId,
    search,
    signedIn: session !== null,
    participant,
    match: matchState ? { state: matchState.state, endedReason: matchState.endedReason, language: matchState.language } : null,
  });
  if (access.kind === "redirect") redirect(access.to);
  if (!matchState) redirect(localePath(locale, "/"));

  // Spec 071 (R8): the first paint knows the viewer's rematch offer.
  const rematch = session && participant ? await readRematchOffer(supabase, matchState, session.player.id) : undefined;
  const initialState = rematch ? { ...matchState, rematch } : matchState;

  const playerProfiles = await loadMatchPlayerProfiles(supabase, matchState.players.playerA.playerId, matchState.players.playerB.playerId, matchState.language);

  return <MatchRoomController currentPlayerId={session?.player.id ?? ""} initialState={initialState} matchId={matchId} playerProfiles={playerProfiles} />;
}

function queryOf(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
