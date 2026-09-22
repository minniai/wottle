"use client";

import { useEffect, useRef } from "react";

import type { OutgoingChallenge } from "@/lib/room/ledgerTypes";

export interface PendingInvite {
  id: string;
  sender: { id: string; username: string; displayName?: string | null };
  expiresAt: string;
}

interface LobbyInviteOptions {
  enabled: boolean;
  /** Every poll: the challenges still pending for the viewer, oldest first. */
  onInvites: (pending: PendingInvite[]) => void;
  /** Every poll: the viewer's latest challenge, or null. */
  onOutgoing: (outgoing: OutgoingChallenge | null) => void;
  onActiveMatch: (matchId: string) => void;
  intervalMs?: number;
}

/** Polls the viewer's challenges, both ways, and an active match (ported from LobbyList). */
export function useLobbyInvites({ enabled, onInvites, onOutgoing, onActiveMatch, intervalMs = 3_000 }: LobbyInviteOptions): void {
  const activeRef = useRef<string | null>(null);
  const callbacks = useRef({ onInvites, onOutgoing, onActiveMatch });
  useEffect(() => {
    callbacks.current = { onInvites, onOutgoing, onActiveMatch };
  }, [onInvites, onOutgoing, onActiveMatch]);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    const poll = async () => {
      try {
        const [inviteRes, activeRes] = await Promise.all([
          fetch("/api/lobby/invite", { cache: "no-store" }),
          fetch("/api/match/active", { cache: "no-store" }),
        ]);
        if (!mounted) return;
        if (inviteRes.ok) {
          const { pending, outgoing } = (await inviteRes.json()) as { pending?: PendingInvite[]; outgoing?: OutgoingChallenge | null };
          callbacks.current.onInvites(pending ?? []);
          callbacks.current.onOutgoing(outgoing ?? null);
        }
        if (activeRes.ok) {
          const { match } = (await activeRes.json()) as { match?: { id: string } | null };
          if (match?.id && activeRef.current !== match.id) {
            activeRef.current = match.id;
            callbacks.current.onActiveMatch(match.id);
          }
        }
      } catch {
        // transient; next tick retries
      }
    };
    void poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}
