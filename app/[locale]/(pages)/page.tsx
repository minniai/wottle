import type { Metadata } from "next";
import { headers } from "next/headers";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { DoorPage } from "@/components/page/door/DoorPage";
import { LobbyPage } from "@/components/page/lobby/LobbyPage";
import { nextParam } from "@/lib/auth/nextParam";
import { readReturningPlayer } from "@/lib/auth/returningPlayer";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, type Locale } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { lobbyRows } from "@/lib/lobby/lobbyRows";
import { publicOverview, viewerOverview } from "@/lib/lobby/overview";
import { readRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { healStuckInMatchStatus, readLobbySession } from "@/lib/matchmaking/profile";
import type { LobbyLanguage } from "@/lib/types/standing";

interface PageProps {
  params?: LocaleParams;
  searchParams?: Promise<{ next?: string }>;
}

export async function generateMetadata({ params }: PageProps = {}): Promise<Metadata> {
  const locale = await readLocaleParam(params);
  const copy = getCopy(locale);
  const { wordmark } = getLocale(locale);
  const session = await readLobbySession();
  return {
    title: session ? copy.pages.lobbyTitle(wordmark) : copy.pages.doorTitle(wordmark),
    alternates: { languages: { is: "/", en: "/en", "x-default": "/" } },
  };
}

/** The browser prefers the other language when its first choice names it (A1). It never redirects. */
async function prefersOther(locale: Locale): Promise<boolean> {
  const first = (await headers()).get("accept-language")?.split(",")[0]?.trim().toLowerCase() ?? "";
  const primary = first.split("-")[0];
  const other = getLocale(getLocale(locale).switchTo);
  return primary === other.htmlLang;
}

/**
 * `/` and `/en` (spec 070 FR-001): the door signed out, the lobby signed in.
 * Signed in, the lobby's first paint is read here; presence follows on the client (SC-008).
 */
export default async function HomePage({ params, searchParams }: PageProps = {}) {
  const locale = await readLocaleParam(params);
  const language = getLocale(locale).language as LobbyLanguage;
  const session = await readLobbySession();
  if (session) return <SignedInLobby playerId={session.player.id} displayName={session.player.displayName} handle={session.player.username} language={language} />;
  const [overview, returning, preferOther, query] = await Promise.all([
    publicOverview(language).catch(() => ({ counts: { here: 0, searching: 0, playersInMatch: 0, matchesOn: 0, other: { language, here: 0 } }, here: [], more: 0 })),
    readReturningPlayer(language),
    prefersOther(locale),
    searchParams ?? Promise.resolve({ next: undefined }),
  ]);
  return <DoorPage overview={overview} returning={returning} next={nextParam(query.next ?? null)} preferOther={preferOther} />;
}

interface SignedInLobbyProps {
  playerId: string;
  displayName: string;
  handle: string;
  language: LobbyLanguage;
}

/** The lobby's first paint, read on the server: your standing, who is here, your last match and matches. */
async function SignedInLobby({ playerId, displayName, handle, language }: SignedInLobbyProps) {
  await healStuckInMatchStatus(playerId);
  const client = getServiceRoleClient();
  // The lobby entered is the player's lobby language (spec 070 FR-033); US7 adds the confirmation.
  await client.from("players").update({ lobby_language: language }).eq("id", playerId);
  const [ratings, rows, overview, recent] = await Promise.all([
    readRatings(client, [playerId], language),
    lobbyRows(playerId, language).catch(() => []),
    viewerOverview(playerId, language),
    getRecentGames({ playerId, limit: 4, language }).catch(() => ({ games: [] })),
  ]);
  const record = ratings.get(playerId)!;
  const viewer = { displayName, handle, rating: record.eloRating, gamesPlayed: record.gamesPlayed, wins: record.wins, losses: record.losses, draws: record.draws };
  return <LobbyPage viewer={viewer} rows={rows} overview={overview} recent={recent.games} />;
}
