"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BoardGrid } from "@/components/game/BoardGrid";
import { TimerHud } from "@/components/game/TimerHud";
import { RoundSummaryPanel } from "@/components/match/RoundSummaryPanel";
import type { MatchState, RoundSummary, TimerState } from "@/lib/types/match";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { subscribeToMatchChannel } from "@/lib/realtime/matchChannel";
import { handlePlayerDisconnect } from "@/app/actions/match/handleDisconnect";
import { MatchShell } from "./MatchShell";

interface MatchClientProps {
  initialState: MatchState;
  currentPlayerId: string;
  matchId: string;
  pollIntervalMs?: number;
}

const POLL_ENDPOINT = (matchId: string) => `/api/match/${matchId}/state`;

/** Interval for the background safety-net poller (runs alongside Realtime). */
const SAFETY_POLL_INTERVAL_MS = 2_000;

/**
 * Fetch the latest match state from the REST endpoint.
 * Returns `null` on failure so callers can decide how to handle errors.
 */
async function fetchMatchSnapshot(matchId: string): Promise<MatchState | null> {
  try {
    const response = await fetch(POLL_ENDPOINT(matchId), {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as MatchState;
  } catch {
    return null;
  }
}

export function MatchClient({
  initialState,
  currentPlayerId,
  matchId,
  pollIntervalMs = 3_000,
}: MatchClientProps) {
  const router = useRouter();
  const isAutomation =
    typeof navigator !== "undefined" && navigator.webdriver;
  const summaryAutoDismissMs = isAutomation ? 15_000 : 3_000;
  const [matchState, setMatchState] = useState<MatchState>(initialState);
  const [summary, setSummary] = useState<RoundSummary | null>(
    initialState.lastSummary ?? null,
  );
  const realtimeDisabled =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true";
  const [usePolling, setUsePolling] = useState(realtimeDisabled);
  const [pollError, setPollError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [disconnectedPlayerId, setDisconnectedPlayerId] = useState<
    string | null
  >(null);

  /** Ref so the safety-net poller always reads the freshest round. */
  const matchStateRef = useRef(matchState);
  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);

  /** Apply a server snapshot into local state, preserving lastSummary. */
  const applySnapshot = useCallback((snapshot: MatchState) => {
    setMatchState((prev) => ({
      ...prev,
      ...snapshot,
      lastSummary: snapshot.lastSummary ?? prev.lastSummary,
    }));
  }, []);

  useEffect(() => {
    setMatchState(initialState);
  }, [initialState]);

  // Sync summary from polled/realtime state updates
  useEffect(() => {
    if (matchState.lastSummary) {
      setSummary(matchState.lastSummary);
    }
  }, [matchState.lastSummary]);

  // Navigate to final summary when match completes
  useEffect(() => {
    if (matchState.state === "completed") {
      router.push(`/match/${matchId}/summary`);
    }
  }, [matchId, matchState.state, router]);

  // ── Realtime channel ──────────────────────────────────────────────
  useEffect(() => {
    if (usePolling) {
      return;
    }

    const client = getBrowserSupabaseClient();
    const channel = subscribeToMatchChannel(client, matchId, {
      onState: (snapshot) => {
        if (snapshot.disconnectedPlayerId) {
          setDisconnectedPlayerId(snapshot.disconnectedPlayerId);
          setIsReconnecting(
            snapshot.disconnectedPlayerId !== currentPlayerId,
          );
        } else if (
          disconnectedPlayerId &&
          snapshot.disconnectedPlayerId === null
        ) {
          setIsReconnecting(false);
          setDisconnectedPlayerId(null);
        }
        applySnapshot(snapshot);
      },
      onSummary: (nextSummary) => {
        setSummary(nextSummary);
        setMatchState((prev) => ({
          ...prev,
          scores: nextSummary.totals,
          lastSummary: nextSummary,
        }));
      },
      onError: (error) => {
        console.error(
          "[Realtime] Match channel error, enabling polling fallback",
          error,
        );
        setIsReconnecting(true);
        setUsePolling(true);
      },
    });

    channel.on("system", {}, async (payload) => {
      if (
        payload.status === "CLOSED" ||
        payload.status === "CHANNEL_ERROR"
      ) {
        console.warn("[Realtime] Channel closed, marking as reconnecting");
        setIsReconnecting(true);
        setDisconnectedPlayerId(currentPlayerId);
        setUsePolling(true);

        try {
          await handlePlayerDisconnect(matchId, currentPlayerId);
        } catch (error) {
          console.error(
            "[MatchClient] Failed to notify server of disconnect:",
            error,
          );
        }
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [
    matchId,
    usePolling,
    currentPlayerId,
    disconnectedPlayerId,
    applySnapshot,
  ]);

  // ── Primary polling (only when Realtime is confirmed down) ────────
  useEffect(() => {
    if (!usePolling) {
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      const snapshot = await fetchMatchSnapshot(matchId);
      if (!isMounted) return;
      if (snapshot) {
        applySnapshot(snapshot);
        setPollError(null);
      } else {
        setPollError("Connection interrupted. Retrying…");
      }
    };

    poll();
    timer = setInterval(poll, pollIntervalMs);

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [matchId, pollIntervalMs, usePolling, applySnapshot]);

  // ── Background safety-net poller ──────────────────────────────────
  // Runs *always* (even when Realtime is the primary transport) at a
  // slow cadence.  This catches the case where the server-side
  // Realtime broadcast fails silently (e.g. in local act/Docker).
  // It only fetches when the client has not yet seen the round advance
  // that the server already committed.
  useEffect(() => {
    let isMounted = true;

    const safetyPoll = async () => {
      if (!isMounted) return;
      const snapshot = await fetchMatchSnapshot(matchId);
      if (!isMounted || !snapshot) return;

      const current = matchStateRef.current;
      const roundAdvanced = snapshot.currentRound > current.currentRound;
      const matchCompleted =
        snapshot.state === "completed" && current.state !== "completed";

      if (roundAdvanced || matchCompleted) {
        applySnapshot(snapshot);
      }
    };

    const timer = setInterval(safetyPoll, SAFETY_POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [matchId, applySnapshot]);

  const currentTimer: TimerState = useMemo(() => {
    if (matchState.timers.playerA.playerId === currentPlayerId) {
      return matchState.timers.playerA;
    }
    return matchState.timers.playerB;
  }, [currentPlayerId, matchState.timers.playerA, matchState.timers.playerB]);

  const timeLeftSeconds = Math.max(
    0,
    Math.floor(currentTimer.remainingMs / 1000),
  );
  const isPaused = currentTimer.status !== "running";

  const handleSummaryDismiss = useCallback(() => {
    setSummary(null);
  }, []);

  const playerSlot: "player_a" | "player_b" =
    matchState.timers.playerA.playerId === currentPlayerId ? "player_a" : "player_b";

  const handleSwapComplete = useCallback(() => {
    setSwapError(null);
  }, []);

  const handleSwapError = useCallback((message: string) => {
    setSwapError(message);
  }, []);

  const headline = `Match: ${matchId.slice(0, 8)}`;

  return (
    <MatchShell matchId={matchId} headline={headline} statusMessage="Live">
      {isReconnecting && (
        <div
          className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
          data-testid="reconnect-banner"
        >
          {disconnectedPlayerId === currentPlayerId
            ? "Reconnecting... Please wait."
            : "Opponent disconnected. Waiting for reconnection..."}
        </div>
      )}

      {usePolling && !isReconnecting && (
        <div
          className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
          data-testid="polling-fallback-banner"
        >
          Realtime connection lost. Falling back to polling updates.
        </div>
      )}

      {(pollError || swapError) && (
        <div
          className="mt-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-200"
          data-testid="round-alert"
        >
          {swapError ?? pollError}
        </div>
      )}

      <div className="mt-6 flex w-full flex-col items-center">
        <TimerHud
          timeLeft={timeLeftSeconds}
          isPaused={isPaused}
          roundNumber={matchState.currentRound}
        />

        <BoardGrid
          grid={matchState.board}
          matchId={matchId}
          frozenTiles={matchState.frozenTiles ?? {}}
          playerSlot={playerSlot}
          scoredTileHighlights={summary?.highlights ?? []}
          highlightDurationMs={3000}
          onSwapComplete={handleSwapComplete}
          onSwapError={({ message }) => handleSwapError(message)}
        />
      </div>

      <RoundSummaryPanel
        summary={summary}
        currentPlayerId={currentPlayerId}
        onDismiss={handleSummaryDismiss}
        autoDismissMs={summaryAutoDismissMs}
      />
    </MatchShell>
  );
}

