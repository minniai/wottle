"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { PlayerIdentity } from "@/lib/types/match";
import { LobbyCard } from "./LobbyCard";
import { MatchmakerControls } from "./MatchmakerControls";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import { getNextRovingIndex } from "@/lib/a11y/rovingFocus";

interface LobbyListProps {
  currentPlayer: PlayerIdentity;
  initialPlayers: PlayerIdentity[];
}

export function LobbyList({ currentPlayer, initialPlayers }: LobbyListProps) {
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
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  
  useEffect(() => {
    // Cancel any pending disconnect from previous mount
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    
    void connect({ self: currentPlayer, initialPlayers });
    
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
        // Check if we're still on the lobby page before disconnecting
        // This prevents disconnecting during redirects where the new page loads with the same user
        const currentPath = window.location.pathname;
        if (currentPath === "/" || currentPath.startsWith("/lobby")) {
          // Still on lobby page, likely a redirect - don't disconnect
          // The new page instance will handle the connection
          return;
        }
        disconnect();
        disconnectTimerRef.current = null;
      }, 250);
    };
  }, [connect, disconnect, currentPlayer, initialPlayers]);

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

  useEffect(() => {
    const knownIds = new Set(players.map((player) => player.id));
    cardRefs.current.forEach((_, key) => {
      if (!knownIds.has(key)) {
        cardRefs.current.delete(key);
      }
    });
  }, [players]);

  const registerCardRef = useCallback((playerId: string, node: HTMLDivElement | null) => {
    if (node) {
      cardRefs.current.set(playerId, node);
    } else {
      cardRefs.current.delete(playerId);
    }
  }, []);

  const handleCardKeyDown = useCallback(
    (playerId: string, event: KeyboardEvent<HTMLDivElement>) => {
      const interactiveKeys = [
        "ArrowRight",
        "ArrowLeft",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ];
      if (!interactiveKeys.includes(event.key)) {
        return;
      }

      event.preventDefault();
      const currentIndex = players.findIndex((player) => player.id === playerId);
      if (currentIndex === -1 || players.length === 0) {
        return;
      }
      const nextIndex = getNextRovingIndex(currentIndex, players.length, event.key);
      const nextPlayerId = players[nextIndex]?.id;
      if (!nextPlayerId) {
        return;
      }
      const nextNode = cardRefs.current.get(nextPlayerId);
      nextNode?.focus();
    },
    [players]
  );

  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);

  const statusLabel = buildStatusLabel(status, connectionMode, lastEventAt);

  return (
    <>
    {profilePlayerId && (
      <PlayerProfileModal
        playerId={profilePlayerId}
        onClose={() => setProfilePlayerId(null)}
      />
    )}
    <section
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-6 text-sm text-white/70 shadow-2xl shadow-slate-950/40"
      data-testid="lobby-presence-list"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">Lobby Presence</p>
          <p className="text-xs text-white/60">Realtime testers currently online</p>
        </div>
        <span
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
          role="status"
          aria-live="polite"
        >
          {statusLabel}
        </span>
      </header>

      <div className="mt-6">
        <MatchmakerControls currentPlayer={currentPlayer} />
      </div>

      {players.length === 0 ? (
        <p className="mt-6 text-xs text-white/60">Waiting for testers to join the lobby…</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2" role="list" aria-label="Online testers">
          {players.map((player) => {
            const accessibleLabel = `${player.displayName ?? player.username}${
              player.id === currentPlayer.id ? " (You)" : ""
            }, status ${player.status.replace("_", " ")}`;
            return (
              <LobbyCard
                key={player.id}
                player={player}
                isSelf={player.id === currentPlayer.id}
                tabIndex={0}
                onKeyDown={(event) => handleCardKeyDown(player.id, event)}
                ariaLabel={accessibleLabel}
                ref={(node) => registerCardRef(player.id, node)}
                viewerRating={currentPlayer.eloRating ?? 1200}
                onUsernameClick={setProfilePlayerId}
              />
            );
          })}
        </div>
      )}

      {connectionMode === "polling" && (
        <div
          className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100"
          role="status"
          aria-live="assertive"
        >
          <p className="font-semibold text-amber-200">Realtime disconnected</p>
          <p className="mt-1">
            Showing snapshot data every few seconds until the realtime channel reconnects.
          </p>
        </div>
      )}

      {error && (
        <div
          className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-100"
          role="alert"
        >
          <p className="font-semibold text-rose-200">Presence unavailable</p>
          <p className="mt-1">{error}</p>
        </div>
      )}
    </section>
    </>
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


