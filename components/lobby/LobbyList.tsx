"use client";

import { useEffect, useRef } from "react";

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
  const setInitialPlayers = useLobbyPresenceStore((state) => state.setInitialPlayers);

  // Use a ref to track disconnect timer across remounts
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Cancel any pending disconnect from previous mount
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    
    void connect({ self, initialPlayers });
    
    // Also cleanup on page unload (e.g., when browser context closes)
    const handleBeforeUnload = () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Delay disconnect to avoid React StrictMode double-mount issues
      // If component remounts quickly, the timer will be cleared above
      disconnectTimerRef.current = setTimeout(() => {
        disconnect();
        disconnectTimerRef.current = null;
      }, 250);
    };
  }, [connect, disconnect, self, initialPlayers]);

  useEffect(() => {
    if (status === "ready" && connectionMode === "realtime") {
      return;
    }

    let cancelled = false;

    async function refreshSnapshot() {
      try {
        const response = await fetch("/api/lobby/players", {
          cache: "no-store",
          headers: {
            accept: "application/json",
          },
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as { players?: PlayerIdentity[] };
        if (!cancelled && Array.isArray(payload.players)) {
          setInitialPlayers(payload.players);
        }
      } catch {
        // allow realtime channel to recover
      }
    }

    refreshSnapshot();
    const interval = setInterval(refreshSnapshot, 2_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, connectionMode, setInitialPlayers]);

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


