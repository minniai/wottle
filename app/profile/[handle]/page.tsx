import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getBestWords } from "@/app/actions/player/getBestWords";
import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { readLobbySession } from "@/lib/matchmaking/profile";

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
      <main className="room">
        <div className="ledger__live-row" data-testid="profile-not-found">No such player · @{handle} has not played a round here yet</div>
      </main>
    );
  }

  if (profileResult.status !== "ok" || !profileResult.profile) {
    return (
      <main className="room">
        <div className="ledger__live-row">profile unavailable · {(profileResult.error ?? "try again in a moment").toLowerCase()}</div>
      </main>
    );
  }

  const [bestWordsResult, recentGamesResult, session] = await Promise.all([
    getBestWords(profileResult.profile.identity.id, 12),
    getRecentGames({
      playerId: profileResult.profile.identity.id,
      limit: 10,
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
