"use client";

import { useEffect, useRef } from "react";

export interface PendingInvite {
  id: string;
  sender: { id: string; username: string; displayName?: string | null };
  expiresAt: string;
}

interface LobbyInviteOptions {
  enabled: boolean;
  onInvite: (invite: PendingInvite) => void;
  onActiveMatch: (matchId: string) => void;
  intervalMs?: number;
}

/** Polls pending invites and an active match (ported from LobbyList). */
export function useLobbyInvites({ enabled, onInvite, onActiveMatch, intervalMs = 3_000 }: LobbyInviteOptions): void {
  const seen = useRef(new Set<string>());
  const activeRef = useRef<string | null>(null);
  const callbacks = useRef({ onInvite, onActiveMatch });
  useEffect(() => {
    callbacks.current = { onInvite, onActiveMatch };
  }, [onInvite, onActiveMatch]);

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
          const { pending } = (await inviteRes.json()) as { pending?: PendingInvite[] };
          for (const invite of pending ?? []) {
            if (seen.current.has(invite.id)) continue;
            seen.current.add(invite.id);
            callbacks.current.onInvite(invite);
          }
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
