"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { handlePlayerDisconnect } from "@/app/actions/match/handleDisconnect";
import { shouldApplySafetySnapshot } from "@/lib/match/safetySnapshot";
import { subscribeToMatchChannel } from "@/lib/realtime/matchChannel";
import { useRoomStore } from "@/lib/room/roomStore";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { MatchState, RematchEvent } from "@/lib/types/match";

export const SAFETY_POLL_INTERVAL_MS = 2_000;

async function fetchMatchSnapshot(matchId: string): Promise<MatchState | null> {
  try {
    const res = await fetch(`/api/match/${matchId}/state`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as MatchState) : null;
  } catch {
    return null;
  }
}

export interface TransportState {
  usePolling: boolean;
  isReconnecting: boolean;
  pollError: string | null;
}

/**
 * Realtime channel + polling fallback + 2 s safety poller + pagehide beacon,
 * ported from MatchClient into the room (spec 044, research R5). Snapshots and
 * summaries land in the room store; the caller reads `match` from there.
 */
export function useMatchTransport(matchId: string, currentPlayerId: string, pollIntervalMs = 3_000, onRematchEvent?: (event: RematchEvent) => void): TransportState {
  const rematchRef = useRef(onRematchEvent);
  useEffect(() => {
    rematchRef.current = onRematchEvent;
  }, [onRematchEvent]);
  const applySnapshot = useRoomStore((s) => s.applySnapshot);
  const applySummary = useRoomStore((s) => s.applySummary);
  const setConnection = useRoomStore((s) => s.setConnection);
  const [usePolling, setUsePolling] = useState(process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const fallBack = useCallback(() => {
    setIsReconnecting(true);
    setUsePolling(true);
    setConnection("polling");
  }, [setConnection]);

  useEffect(() => {
    if (usePolling) return;
    const client = getBrowserSupabaseClient();
    const channel = subscribeToMatchChannel(client, matchId, {
      presenceKey: currentPlayerId,
      onState: (snapshot) => {
        applySnapshot(snapshot);
        if (snapshot.disconnectedPlayerId !== currentPlayerId) setIsReconnecting(false);
      },
      onSummary: applySummary,
      onRematchEvent: (event) => rematchRef.current?.(event),
      onOpponentLeave: ({ playerId }) => {
        void handlePlayerDisconnect(matchId, playerId).catch((error) =>
          console.error("[room] failed to notify opponent disconnect", error),
        );
      },
      onError: fallBack,
    });
    channel.on("system", {}, async (payload: { status?: string }) => {
      if (payload.status === "CLOSED" || payload.status === "CHANNEL_ERROR") {
        fallBack();
        await handlePlayerDisconnect(matchId, currentPlayerId).catch(() => undefined);
      }
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [matchId, currentPlayerId, usePolling, applySnapshot, applySummary, fallBack]);

  useEffect(() => {
    const notify = () => navigator.sendBeacon?.(`/api/match/${matchId}/disconnect`);
    window.addEventListener("pagehide", notify);
    return () => window.removeEventListener("pagehide", notify);
  }, [matchId]);

  useEffect(() => {
    if (!usePolling) return;
    let mounted = true;
    const poll = async () => {
      const snapshot = await fetchMatchSnapshot(matchId);
      if (!mounted) return;
      if (snapshot) {
        applySnapshot(snapshot);
        setPollError(null);
      } else setPollError("connection interrupted · retrying");
    };
    void poll();
    const timer = setInterval(poll, pollIntervalMs);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [matchId, usePolling, pollIntervalMs, applySnapshot]);

  const latest = useRef<MatchState | null>(null);
  useEffect(() => useRoomStore.subscribe((s) => (latest.current = s.match)), []);
  useEffect(() => {
    let mounted = true;
    const safetyPoll = async () => {
      const snapshot = await fetchMatchSnapshot(matchId);
      if (mounted && snapshot && latest.current && shouldApplySafetySnapshot(latest.current, snapshot)) applySnapshot(snapshot);
    };
    const timer = setInterval(safetyPoll, SAFETY_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [matchId, applySnapshot]);

  return { usePolling, isReconnecting, pollError };
}
