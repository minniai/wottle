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
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 pb-24 pt-6 sm:gap-12 sm:px-8 sm:pb-16 sm:pt-10">
      <LobbyHero />

      {session ? (
        <>
          <LobbyStatsStrip />
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
        </>
      ) : (
        <Card elevation={0} className="lobby-cta-card space-y-5 p-6 sm:p-8">
          <div>
            <p className="font-display text-2xl font-semibold text-text-primary sm:text-3xl">
              Enter the lobby
            </p>
            <p className="text-sm text-text-secondary">
              Pick a username to appear to other players and start challenging.
            </p>
          </div>
          <LobbyLoginForm />
        </Card>
      )}
    </main>
  );
}
