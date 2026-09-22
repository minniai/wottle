import { getLocale } from "@/lib/i18n/locales";
import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getBestWords } from "@/app/actions/player/getBestWords";
import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { getCopy } from "@/lib/i18n/getCopy";
import { readLocaleParam } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";

interface Params {
  handle: string;
  locale?: string;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const resolved = await params;
  const { handle } = resolved;
  const locale = await readLocaleParam(resolved);
  const copy = getCopy(locale);
  const { language } = getLocale(locale);
  const profileResult = await getPlayerProfileByHandle(handle, language);

  if (profileResult.status === "not_found") {
    return (
      <main className="room">
        <div className="ledger__live-row" data-testid="profile-not-found">{copy.noSuchPlayer(handle)}</div>
      </main>
    );
  }

  if (profileResult.status !== "ok" || !profileResult.profile) {
    return (
      <main className="room">
        <div className="ledger__live-row">{copy.profileUnavailable(profileResult.error ?? null)}</div>
      </main>
    );
  }

  const [bestWordsResult, recentGamesResult, session] = await Promise.all([
    getBestWords(profileResult.profile.identity.id, 12, language),
    getRecentGames({
      playerId: profileResult.profile.identity.id,
      limit: 10,
      language,
    }),
    readLobbySession(),
  ]);

  const isSelf = session?.player.id === profileResult.profile.identity.id;

  return (
    <ProfilePage
      profile={profileResult.profile}
      words={bestWordsResult.words ?? []}
      matches={recentGamesResult.games ?? []}
      isSelf={isSelf}
    />
  );
}
