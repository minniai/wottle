import type { Metadata } from "next";
import { headers } from "next/headers";

import { LobbyRoomPage } from "@/app/[locale]/(room)/LobbyRoomPage";
import { DoorPage } from "@/components/page/door/DoorPage";
import { RoomShell } from "@/components/room/RoomShell";
import { nextParam } from "@/lib/auth/nextParam";
import { readReturningPlayer } from "@/lib/auth/returningPlayer";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, type Locale } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { publicOverview } from "@/lib/lobby/overview";
import { readLobbySession, viewerInLanguage } from "@/lib/matchmaking/profile";
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
 * The lobby's page arrives with US2; until then the room's lobby renders here.
 */
export default async function HomePage({ params, searchParams }: PageProps = {}) {
  const locale = await readLocaleParam(params);
  const language = getLocale(locale).language as LobbyLanguage;
  const session = await readLobbySession();
  if (session) {
    const viewer = await viewerInLanguage(session.player, language);
    return (
      <RoomShell viewer={viewer} returning={null}>
        <LobbyRoomPage session={session} language={language} />
      </RoomShell>
    );
  }
  const [overview, returning, preferOther, query] = await Promise.all([
    publicOverview(language).catch(() => ({ counts: { here: 0, searching: 0, playersInMatch: 0, matchesOn: 0, other: { language, here: 0 } }, here: [], more: 0 })),
    readReturningPlayer(language),
    prefersOther(locale),
    searchParams ?? Promise.resolve({ next: undefined }),
  ]);
  return <DoorPage overview={overview} returning={returning} next={nextParam(query.next ?? null)} preferOther={preferOther} />;
}
