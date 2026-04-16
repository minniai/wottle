import { LobbyHero } from "@/components/lobby/LobbyHero";
import { LobbyList } from "@/components/lobby/LobbyList";
import { LobbyLoginForm } from "@/components/lobby/LobbyLoginForm";
import { LobbyStatsStrip } from "@/components/lobby/LobbyStatsStrip";
import { PlayNowCard } from "@/components/lobby/PlayNowCard";
import { Card } from "@/components/ui/Card";
import { fetchLobbySnapshot, readLobbySession } from "@/lib/matchmaking/profile";

export default async function LobbyPage() {
  const session = await readLobbySession();
  const initialPlayers = session ? await fetchLobbySnapshot() : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 overflow-x-hidden p-6 text-text-primary">
      <LobbyHero />

      {session ? (
        <>
          <LobbyStatsStrip />
          <PlayNowCard currentPlayer={session.player} />
          <LobbyList
            currentPlayer={session.player}
            initialPlayers={initialPlayers}
          />
        </>
      ) : (
        <Card elevation={1} className="space-y-4">
          <div>
            <p className="font-display text-xl font-semibold text-text-primary">
              Play Now
            </p>
            <p className="text-sm text-text-secondary">
              Pick a username to enter the lobby and challenge other players.
            </p>
          </div>
          <LobbyLoginForm />
        </Card>
      )}
    </main>
  );
}
