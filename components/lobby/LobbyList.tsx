"use client";

import { useEffect } from "react";

import type { PlayerIdentity } from "../../lib/types/match";
import { LobbyCard } from "./LobbyCard";
import { MatchmakerControls } from "./MatchmakerControls";
import { useLobbyPresenceStore } from "../../lib/matchmaking/presenceStore";

interface LobbyListProps {
  self: PlayerIdentity;
  initialPlayers: PlayerIdentity[];
}

export function LobbyList({ self, initialPlayers }: LobbyListProps) {
  const players = useLobbyPresenceStore((state) => state.players);
  const status = useLobbyPresenceStore((state) => state.status);
  const connectionMode = useLobbyPresenceStore((state) => state.connectionMode);
  const error = useLobbyPresenceStore((state) => state.error);
  const lastEventAt = useLobbyPresenceStore((state) => state.lastEventAt);
  const connect = useLobbyPresenceStore((state) => state.connect);
  const disconnect = useLobbyPresenceStore((state) => state.disconnect);

  useEffect(() => {
    void connect({ self, initialPlayers });
    return () => {
      disconnect();
    };
  }, [connect, disconnect, self, initialPlayers]);

  const statusLabel = buildStatusLabel(status, connectionMode, lastEventAt);

  return (
    <section
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-6 text-sm text-white/70 shadow-2xl shadow-slate-950/40"
      data-testid="lobby-presence-list"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">Lobby Presence</p>
          <p className="text-xs text-white/60">Realtime testers currently online</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
          {statusLabel}
        </span>
      </header>

      <div className="mt-6">
        <MatchmakerControls self={self} />
      </div>

      {players.length === 0 ? (
        <p className="mt-6 text-xs text-white/60">Waiting for testers to join the lobby…</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {players.map((player) => (
            <LobbyCard key={player.id} player={player} isSelf={player.id === self.id} />
          ))}
        </div>
      )}

      {connectionMode === "polling" && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
          <p className="font-semibold text-amber-200">Realtime disconnected</p>
          <p className="mt-1">
            Showing snapshot data every few seconds until the realtime channel reconnects.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-100">
          <p className="font-semibold text-rose-200">Presence unavailable</p>
          <p className="mt-1">{error}</p>
        </div>
      )}
    </section>
  );
}

function buildStatusLabel(
  status: ReturnType<typeof useLobbyPresenceStore.getState>["status"],
  mode: ReturnType<typeof useLobbyPresenceStore.getState>["connectionMode"],
  lastEventAt: number | null
): string {
  const base = status === "ready" ? "Realtime" : status === "connecting" ? "Connecting" : "Idle";
  const modeLabel = mode === "polling" ? "Polling" : "Realtime";

  if (lastEventAt && status === "ready") {
    const time = new Date(lastEventAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${modeLabel} · Updated ${time}`;
  }

  return `${base} · ${modeLabel}`;
}


