import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProfileNotice } from "@/components/profile/ProfileNotice";
import { ProfilePublicPage } from "@/components/profile/ProfilePublicPage";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, localePath } from "@/lib/i18n/locales";
import { readLocaleParam } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { playerIdForHandle, readProfile } from "@/lib/profile/readProfile";
import { readHandle } from "@/lib/profile/readHandle";

interface Params {
  handle: string;
  locale?: string;
}

type Props = { params: Promise<Params> | Params };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await params;
  const locale = await readLocaleParam(resolved);
  return { title: getCopy(locale).pages.profileTitle(readHandle(resolved.handle), getLocale(locale).wordmark) };
}

/**
 * `/profile/:handle` (spec 072 US6, US7, E2): another player's profile in this
 * page's language. Your own handle goes to `/profile`; an unknown one is a 404.
 * Anyone may read it, signed out included.
 */
export default async function PublicProfilePage({ params }: Props) {
  const resolved = await params;
  const locale = await readLocaleParam(resolved);
  const { language } = getLocale(locale);
  const [playerId, session] = await Promise.all([playerIdForHandle(resolved.handle), readLobbySession()]);
  if (!playerId) notFound();
  if (session?.player.id === playerId) redirect(localePath(locale, "/profile"));
  const view = await readProfile(playerId, language, { kind: "public", viewerId: session?.player.id ?? null }).catch(() => null);
  if (!view) return <ProfileNotice locale={locale} text={getCopy(locale).profileUnavailable(null)} testId="profile-unavailable" />;
  return <ProfilePublicPage view={view} signedIn={Boolean(session)} />;
}
