"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { LobbyDirectory } from "@/components/lobby/LobbyDirectory";
import {
  InviteDialog,
  type IncomingInvite,
} from "@/components/lobby/InviteDialog";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { getNextRovingIndex } from "@/lib/a11y/rovingFocus";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import type { PlayerIdentity } from "@/lib/types/match";

interface LobbyListProps {
  currentPlayer: PlayerIdentity;
  initialPlayers: PlayerIdentity[];
}

type InviteState =
  | { kind: "none" }
  | { kind: "send"; opponent: PlayerIdentity }
  | { kind: "receive"; invite: IncomingInvite };

export function LobbyList({ currentPlayer, initialPlayers }: LobbyListProps) {
  const router = useRouter();
  const players = useLobbyPresenceStore((state) => state.players);
  const status = useLobbyPresenceStore((state) => state.status);
  const connectionMode = useLobbyPresenceStore((state) => state.connectionMode);
  const error = useLobbyPresenceStore((state) => state.error);
  const connect = useLobbyPresenceStore((state) => state.connect);
  const disconnect = useLobbyPresenceStore((state) => state.disconnect);
  const setInitialPlayers = useLobbyPresenceStore(
    (state) => state.setInitialPlayers,
  );
  const updateSelfStatus = useLobbyPresenceStore(
    (state) => state.updateSelfStatus,
  );

  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const activeMatchIdRef = useRef<string | null>(null);

  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteState>({ kind: "none" });

  useEffect(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    void connect({ self: currentPlayer, initialPlayers });

    const handleBeforeUnload = () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      disconnect();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      disconnectTimerRef.current = setTimeout(() => {
        const currentPath = window.location.pathname;
        if (currentPath === "/" || currentPath.startsWith("/lobby")) {
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
          headers: { accept: "application/json" },
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as {
          players?: PlayerIdentity[];
        };
        if (!cancelled && Array.isArray(payload.players)) {
          setInitialPlayers(payload.players);
        }
      } catch {
        // allow realtime to recover
      }
    }
    void refreshSnapshot();
    const interval = setInterval(refreshSnapshot, 2_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, connectionMode, setInitialPlayers]);

  useEffect(() => {
    let cancelled = false;
    async function pollInvitesAndMatch() {
      try {
        const [inviteRes, matchRes] = await Promise.all([
          fetch("/api/lobby/invite", { cache: "no-store" }),
          fetch("/api/match/active", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (inviteRes.ok) {
          const payload = (await inviteRes.json()) as {
            pending?: IncomingInvite[];
          };
          const pending = payload.pending?.[0] ?? null;
          if (pending) {
            setInvite((prev) =>
              prev.kind === "receive" && prev.invite.id === pending.id
                ? prev
                : { kind: "receive", invite: pending },
            );
          } else {
            setInvite((prev) => (prev.kind === "receive" ? { kind: "none" } : prev));
          }
        }
        if (matchRes.ok) {
          const payload = (await matchRes.json()) as {
            match?: { id: string | null } | null;
          };
          const matchId = payload.match?.id;
          if (matchId && activeMatchIdRef.current !== matchId) {
            activeMatchIdRef.current = matchId;
            updateSelfStatus("in_match");
            setInvite({ kind: "none" });
            router.push(`/match/${matchId}`);
          }
        }
      } catch {
        // non-fatal
      }
    }
    void pollInvitesAndMatch();
    const timer = setInterval(pollInvitesAndMatch, 3_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router, updateSelfStatus]);

  useEffect(() => {
    const knownIds = new Set(players.map((p) => p.id));
    cardRefs.current.forEach((_, key) => {
      if (!knownIds.has(key)) {
        cardRefs.current.delete(key);
      }
    });
  }, [players]);

  const registerCardRef = useCallback(
    (playerId: string, node: HTMLDivElement | null) => {
      if (node) {
        cardRefs.current.set(playerId, node);
      } else {
        cardRefs.current.delete(playerId);
      }
    },
    [],
  );

  const handleCardKeyDown = useCallback(
    (playerId: string, event: KeyboardEvent<HTMLDivElement>) => {
      const navKeys = [
        "ArrowRight",
        "ArrowLeft",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ];
      if (!navKeys.includes(event.key)) {
        return;
      }
      event.preventDefault();
      const index = players.findIndex((p) => p.id === playerId);
      if (index === -1 || players.length === 0) return;
      const nextIndex = getNextRovingIndex(index, players.length, event.key);
      const nextId = players[nextIndex]?.id;
      if (!nextId) return;
      cardRefs.current.get(nextId)?.focus();
    },
    [players],
  );

  const handleChallenge = useCallback(
    (playerId: string) => {
      const opponent = players.find((p) => p.id === playerId);
      if (!opponent) return;
      setInvite({ kind: "send", opponent });
    },
    [players],
  );

  return (
    <>
      {profilePlayerId ? (
        <PlayerProfileModal
          playerId={profilePlayerId}
          onClose={() => setProfilePlayerId(null)}
        />
      ) : null}

      <section data-testid="lobby-presence-list" className="space-y-4">
        <LobbyDirectory
          players={players}
          selfId={currentPlayer.id}
          viewerRating={currentPlayer.eloRating ?? 1200}
          connectionStatus={status}
          onChallenge={handleChallenge}
          onUsernameClick={setProfilePlayerId}
          onCardKeyDown={handleCardKeyDown}
          registerCardRef={registerCardRef}
        />
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-player-b/40 bg-player-b/10 p-4 text-xs text-rose-100"
          >
            <p className="font-semibold">Presence unavailable</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}
      </section>

      {invite.kind === "send" ? (
        <InviteDialog
          variant="send"
          open
          onClose={() => setInvite({ kind: "none" })}
          opponent={{
            id: invite.opponent.id,
            username: invite.opponent.username,
            displayName: invite.opponent.displayName ?? invite.opponent.username,
          }}
        />
      ) : null}

      {invite.kind === "receive" ? (
        <InviteDialog
          variant="receive"
          open
          onClose={() => setInvite({ kind: "none" })}
          invite={invite.invite}
        />
      ) : null}
    </>
  );
}
