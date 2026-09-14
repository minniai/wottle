import { redirect } from "next/navigation";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { LobbyRoomController } from "@/components/room/LobbyRoomController";
import { fetchLobbySnapshot, healStuckInMatchStatus, readLobbySession } from "@/lib/matchmaking/profile";

export default async function LobbyPage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }

  await healStuckInMatchStatus(session.player.id);

  const [initialPlayers, recentGamesResult] = await Promise.all([
    fetchLobbySnapshot(),
    getRecentGames({ playerId: session.player.id, limit: 6 }).catch((error) => {
      console.error(JSON.stringify({ event: "lobby.recent_games.failed", error: error instanceof Error ? error.message : String(error) }));
      return { games: [] };
    }),
  ]);

  return <LobbyRoomController viewer={session.player} initialPlayers={initialPlayers} recentGames={recentGamesResult.games} />;
}
