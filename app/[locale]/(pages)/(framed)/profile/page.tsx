import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileNotice } from "@/components/profile/ProfileNotice";
import { ProfileOwnPage } from "@/components/profile/ProfileOwnPage";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, localePath } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { readProfile } from "@/lib/profile/readProfile";

export async function generateMetadata({ params }: { params?: LocaleParams } = {}): Promise<Metadata> {
  const locale = await readLocaleParam(params);
  const session = await readLobbySession();
  const { wordmark } = getLocale(locale);
  return { title: session ? getCopy(locale).pages.profileTitle(session.player.displayName, wordmark) : wordmark };
}

/** `/profile` (spec 072 US5, E1): your profile in this page's language. Signed out, the door returns here after entry. */
export default async function OwnProfilePage({ params }: { params?: LocaleParams } = {}) {
  const locale = await readLocaleParam(params);
  const { language } = getLocale(locale);
  const session = await readLobbySession();
  if (!session) redirect(`${localePath(locale, "/")}?next=${encodeURIComponent(localePath(locale, "/profile"))}`);
  const view = await readProfile(session.player.id, language, { kind: "own" }).catch(() => null);
  if (!view) return <ProfileNotice locale={locale} text={getCopy(locale).profileUnavailable(null)} testId="profile-unavailable" />;
  return <ProfileOwnPage view={view} />;
}
