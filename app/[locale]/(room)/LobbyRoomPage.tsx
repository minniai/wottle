import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { LobbyRoomController } from "@/components/room/LobbyRoomController";
import type { Language } from "@/lib/types/game-config";
import { fetchLobbySnapshot, healStuckInMatchStatus, viewerInLanguage, type LobbySession } from "@/lib/matchmaking/profile";

/**
 * The lobby room for both `/` and `/lobby` (spec 044 US7). One server component
 * behind both routes so that signing in — which makes the router re-render the
 * current route after the session cookie is set — changes the controller's props
 * instead of swapping page segments and remounting the field. Signed out, the
 * bottom seat is empty; the controller rewrites the URL to `/lobby` once a viewer exists.
 */
export async function LobbyRoomPage({ session, language = "is" }: { session: LobbySession | null; language?: Language }) {
  if (!session) {
    return <LobbyRoomController viewer={null} initialPlayers={[]} recentGames={null} />;
  }

  await healStuckInMatchStatus(session.player.id);

  const [initialPlayers, recentGamesResult, viewer] = await Promise.all([
    fetchLobbySnapshot(language),
    getRecentGames({ playerId: session.player.id, limit: 6, language }).catch((error) => {
      console.error(JSON.stringify({ event: "lobby.recent_games.failed", error: error instanceof Error ? error.message : String(error) }));
      return { games: [] };
    }),
    viewerInLanguage(session.player, language),
  ]);

  return <LobbyRoomController viewer={viewer} initialPlayers={initialPlayers} recentGames={recentGamesResult.games} />;
}
