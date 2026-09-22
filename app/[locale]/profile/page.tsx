import { redirect } from "next/navigation";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getBestWords } from "@/app/actions/player/getBestWords";
import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, localePath } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function OwnProfilePage({ params }: { params?: LocaleParams } = {}) {
  const locale = await readLocaleParam(params);
  const { language } = getLocale(locale);
  const session = await readLobbySession();
  if (!session) {
    redirect(localePath(locale, "/"));
  }

  const [profileResult, bestWordsResult, recentGamesResult] = await Promise.all([
    getPlayerProfile(session.player.id, language),
    getBestWords(session.player.id, 12, language),
    getRecentGames({ playerId: session.player.id, limit: 10, language }),
  ]);

  if (profileResult.status !== "ok" || !profileResult.profile) {
    return (
      <main className="room">
        <div className="ledger__live-row">{getCopy(locale).profileUnavailable(profileResult.error ?? null)}</div>
      </main>
    );
  }

  return (
    <ProfilePage
      profile={profileResult.profile}
      words={bestWordsResult.words ?? []}
      matches={recentGamesResult.games ?? []}
      isSelf
    />
  );
}
