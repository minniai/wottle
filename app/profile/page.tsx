import { redirect } from "next/navigation";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getBestWords } from "@/app/actions/player/getBestWords";
import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function OwnProfilePage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }

  const [profileResult, bestWordsResult, recentGamesResult] = await Promise.all([
    getPlayerProfile(session.player.id),
    getBestWords(session.player.id, 12),
    getRecentGames({ playerId: session.player.id, limit: 10 }),
  ]);

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

  return (
    <ProfilePage
      profile={profileResult.profile}
      words={bestWordsResult.words ?? []}
      matches={recentGamesResult.games ?? []}
      isSelf
    />
  );
}
