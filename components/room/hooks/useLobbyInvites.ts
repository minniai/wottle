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
  intervalMs?: number;
}

/** Polls the viewer's challenges, both ways (ported from LobbyList); a waiting table is `useTableCheck`'s (spec 069). */
export function useLobbyInvites({ enabled, onInvites, onOutgoing, intervalMs = 3_000 }: LobbyInviteOptions): void {
  const callbacks = useRef({ onInvites, onOutgoing });
  useEffect(() => {
    callbacks.current = { onInvites, onOutgoing };
  }, [onInvites, onOutgoing]);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    const poll = async () => {
      try {
        const inviteRes = await fetch("/api/lobby/invite", { cache: "no-store" });
        if (!mounted) return;
        if (inviteRes.ok) {
          const { pending, outgoing } = (await inviteRes.json()) as { pending?: PendingInvite[]; outgoing?: OutgoingChallenge | null };
          callbacks.current.onInvites(pending ?? []);
          callbacks.current.onOutgoing(outgoing ?? null);
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
