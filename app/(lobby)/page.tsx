import { LobbyList } from "@/components/lobby/LobbyList";
import { LobbyLoginForm } from "@/components/lobby/LobbyLoginForm";
import { LobbyStatsStrip } from "@/components/lobby/LobbyStatsStrip";
import { PlayNowCard } from "@/components/lobby/PlayNowCard";
import { fetchLobbySnapshot, readLobbySession } from "@/lib/matchmaking/profile";

export default async function LobbyPage() {
  const session = await readLobbySession();
  const initialPlayers = session ? await fetchLobbySnapshot() : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 overflow-x-hidden p-6 text-white">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">Phase 3</p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Authenticate &amp; Enter Lobby</h1>
        <p className="text-sm text-white/70">
          Log in with a playtest username to appear in the realtime lobby. Stay visible via Supabase
          presence with automatic polling fallback whenever WebSockets drop.
        </p>
      </header>

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
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 p-6 text-sm text-white/70">
            <p className="text-base font-semibold text-white">Lobby preview</p>
            <p className="mt-2 text-xs text-white/60">
              Enter a username to appear here and see other testers join or leave in real time.
            </p>
          </div>
          <LobbyLoginForm />
        </section>
      )}
    </main>
  );
}
