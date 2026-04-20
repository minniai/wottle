import { redirect } from "next/navigation";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getTopPlayers } from "@/app/actions/player/getTopPlayers";
import { LobbyHero } from "@/components/lobby/LobbyHero";
import { LobbyList } from "@/components/lobby/LobbyList";
import { LobbyStatsStrip } from "@/components/lobby/LobbyStatsStrip";
import { PlayNowCard } from "@/components/lobby/PlayNowCard";
import { RecentGamesCard } from "@/components/lobby/RecentGamesCard";
import { TopOfBoardCard } from "@/components/lobby/TopOfBoardCard";
import {
  fetchLobbySnapshot,
  healStuckInMatchStatus,
  readLobbySession,
} from "@/lib/matchmaking/profile";

export default async function LobbyPage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }

  await healStuckInMatchStatus(session.player.id);

  const [initialPlayers, topPlayersResult, recentGamesResult] =
    await Promise.all([
      fetchLobbySnapshot(),
      getTopPlayers({ limit: 6 }).catch(() => ({ players: [] })),
      getRecentGames({ playerId: session.player.id, limit: 6 }).catch(
        () => ({ games: [] }),
      ),
    ]);

  return (
    <main
      data-testid="lobby-shell"
      className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 pb-24 pt-6 sm:gap-12 sm:px-8 sm:pb-16 sm:pt-10"
    >
      <LobbyHero />
      <LobbyStatsStrip selfId={session.player.id} />
      <PlayNowCard currentPlayer={session.player} />
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-text-primary">
            Players online
          </h2>
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
            Live lobby
          </p>
        </div>
        <LobbyList
          currentPlayer={session.player}
          initialPlayers={initialPlayers}
        />
      </section>
      <section
        className="grid gap-6 lg:grid-cols-[1.6fr_1fr]"
        aria-label="Lobby activity"
      >
        <RecentGamesCard games={recentGamesResult.games} />
        <TopOfBoardCard players={topPlayersResult.players} />
      </section>
    </main>
  );
}
