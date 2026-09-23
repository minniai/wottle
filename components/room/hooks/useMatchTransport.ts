"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { handlePlayerDisconnect, handlePlayerReconnect } from "@/app/actions/match/handleDisconnect";
import { shouldApplySafetySnapshot } from "@/lib/match/safetySnapshot";
import { subscribeToMatchChannel } from "@/lib/realtime/matchChannel";
import { useRoomStore } from "@/lib/room/roomStore";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { MatchState, RematchEvent } from "@/lib/types/match";
import { attentionQuery, type Attention } from "@/lib/matchmaking/attention";

import { useAttention } from "./useAttention";

export const SAFETY_POLL_INTERVAL_MS = 2_000;

async function fetchMatchSnapshot(matchId: string, attention: Attention): Promise<MatchState | null> {
  try {
    // The poll reports the tab's attention, so a player on the result screen can be seated at a rematch (spec 069 R5).
    const res = await fetch(`/api/match/${matchId}/state?${attentionQuery(attention)}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as MatchState) : null;
  } catch {
    return null;
  }
}

export interface TransportState {
  usePolling: boolean;
  isReconnecting: boolean;
  pollError: string | null;
  /** The viewer's own connection is lost (spec 068 FR-038): two failed polls in a row, or the browser says so. */
  offline: boolean;
  /** Set on recovery: how long the viewer was away. */
  awayMs: number | null;
}

/** Two failed safety polls in a row (about 4s) are an outage; one is a hiccup. */
const OUTAGE_AFTER_FAILURES = 2;

/**
 * The viewer's own outage, noticed and recovered without a page load (spec 068
 * R8): lost at the first of two failed polls or when the browser goes offline;
 * back at the first good poll, which clears the viewer's disconnect on the server.
 */
function useOutage(matchId: string, currentPlayerId: string) {
  const [offline, setOffline] = useState(false);
  const [awayMs, setAwayMs] = useState<number | null>(null);
  const failures = useRef(0);
  const lostAt = useRef<number | null>(null);
  const firstFailureAt = useRef<number | null>(null);

  const markLost = useCallback((at: number) => {
    if (lostAt.current !== null) return;
    lostAt.current = at;
    setOffline(true);
  }, []);

  const onPoll = useCallback(
    (ok: boolean) => {
      if (!ok) {
        failures.current += 1;
        firstFailureAt.current ??= Date.now();
        if (failures.current >= OUTAGE_AFTER_FAILURES) markLost(firstFailureAt.current);
        return;
      }
      failures.current = 0;
      firstFailureAt.current = null;
      if (lostAt.current === null) return;
      setAwayMs(Date.now() - lostAt.current);
      lostAt.current = null;
      setOffline(false);
      void handlePlayerReconnect(matchId, currentPlayerId).catch(() => undefined);
    },
    [matchId, currentPlayerId, markLost],
  );

  useEffect(() => {
    const goneOffline = () => markLost(Date.now());
    window.addEventListener("offline", goneOffline);
    return () => window.removeEventListener("offline", goneOffline);
  }, [markLost]);

  return { offline, awayMs, onPoll };
}

/**
 * Realtime channel + polling fallback + 2 s safety poller + pagehide beacon,
 * ported from MatchClient into the room (spec 044, research R5). Snapshots and
 * resolutions land in the room store; the caller reads `match` from there.
 */
export function useMatchTransport(matchId: string, currentPlayerId: string, pollIntervalMs = 3_000, onRematchEvent?: (event: RematchEvent) => void): TransportState {
  const rematchRef = useRef(onRematchEvent);
  useEffect(() => {
    rematchRef.current = onRematchEvent;
  }, [onRematchEvent]);
  const applySnapshot = useRoomStore((s) => s.applySnapshot);
  const applyResolution = useRoomStore((s) => s.applyResolution);
  const setConnection = useRoomStore((s) => s.setConnection);
  const [usePolling, setUsePolling] = useState(process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const outage = useOutage(matchId, currentPlayerId);
  const attention = useAttention();
  const onPoll = outage.onPoll;

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
      onMoveResolved: applyResolution,
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
  }, [matchId, currentPlayerId, usePolling, applySnapshot, applyResolution, fallBack]);

  useEffect(() => {
    // At the table there is no match to be disconnected from: closing the tab simply leaves the seat empty (spec 069).
    const notify = () => useRoomStore.getState().match?.state !== "pending" && navigator.sendBeacon?.(`/api/match/${matchId}/disconnect`);
    window.addEventListener("pagehide", notify);
    return () => window.removeEventListener("pagehide", notify);
  }, [matchId]);

  useEffect(() => {
    if (!usePolling) return;
    let mounted = true;
    const poll = async () => {
      const snapshot = await fetchMatchSnapshot(matchId, attention());
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
  }, [matchId, usePolling, pollIntervalMs, applySnapshot, attention]);

  const latest = useRef<MatchState | null>(null);
  useEffect(() => useRoomStore.subscribe((s) => (latest.current = s.match)), []);
  useEffect(() => {
    let mounted = true;
    const safetyPoll = async () => {
      const snapshot = await fetchMatchSnapshot(matchId, attention());
      if (!mounted) return;
      onPoll(snapshot !== null);
      if (snapshot && latest.current && shouldApplySafetySnapshot(latest.current, snapshot)) applySnapshot(snapshot);
    };
    const timer = setInterval(safetyPoll, SAFETY_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [matchId, applySnapshot, onPoll, attention]);

  return { usePolling, isReconnecting, pollError, offline: outage.offline, awayMs: outage.awayMs };
}
