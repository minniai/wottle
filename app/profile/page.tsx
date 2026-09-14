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
      <main className="room">
        <div className="ledger__live-row">profile unavailable · {(profileResult.error ?? "try again in a moment").toLowerCase()}</div>
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
