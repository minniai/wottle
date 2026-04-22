import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getBestWords } from "@/app/actions/player/getBestWords";
import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import { ProfilePage } from "@/components/profile/ProfilePage";

interface Params {
  handle: string;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const { handle } = await params;
  const profileResult = await getPlayerProfileByHandle(handle);

  if (profileResult.status === "not_found") {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-ink">No such player</h1>
        <p className="mt-2 text-sm text-ink-3">
          @{handle} hasn&apos;t played a round here yet.
        </p>
      </main>
    );
  }

  if (profileResult.status !== "ok" || !profileResult.profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-bad">Profile unavailable</h1>
        <p className="mt-2 text-sm text-ink-3">
          {profileResult.error ?? "Try again in a moment."}
        </p>
      </main>
    );
  }

  const [bestWordsResult, recentGamesResult] = await Promise.all([
    getBestWords(profileResult.profile.identity.id, 12),
    getRecentGames({
      playerId: profileResult.profile.identity.id,
      limit: 10,
    }),
  ]);

  return (
    <ProfilePage
      profile={profileResult.profile}
      words={bestWordsResult.words ?? []}
      matches={recentGamesResult.games ?? []}
    />
  );
}
