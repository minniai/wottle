"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export function MatchClient({
  initialState,
  currentPlayerId,
  matchId,
  pollIntervalMs = 3_000,
}: MatchClientProps) {
  const router = useRouter();
  const [matchState, setMatchState] = useState<MatchState>(initialState);
  const [summary, setSummary] = useState<RoundSummary | null>(
    initialState.lastSummary ?? null,
  );
  const realtimeDisabled =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true";
  const [usePolling, setUsePolling] = useState(realtimeDisabled);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [disconnectedPlayerId, setDisconnectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setMatchState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (matchState.state === "completed") {
      router.push(`/match/${matchId}/summary`);
    }
  }, [matchId, matchState.state, router]);

  useEffect(() => {
    if (usePolling) {
      return;
    }

    const client = getBrowserSupabaseClient();
    const channel = subscribeToMatchChannel(client, matchId, {
      onState: (snapshot) => {
        // Check if snapshot indicates a disconnected player
        if (snapshot.disconnectedPlayerId) {
          setDisconnectedPlayerId(snapshot.disconnectedPlayerId);
          setIsReconnecting(snapshot.disconnectedPlayerId !== currentPlayerId);
        } else {
          // Player reconnected
          if (disconnectedPlayerId && snapshot.disconnectedPlayerId === null) {
            setIsReconnecting(false);
            setDisconnectedPlayerId(null);
          }
        }
        setMatchState((prev) => ({
          ...prev,
          ...snapshot,
          lastSummary: snapshot.lastSummary ?? prev.lastSummary,
        }));
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
        console.error("[Realtime] Match channel error, enabling polling fallback", error);
        setIsReconnecting(true);
        setUsePolling(true);
      },
    });

    // Detect channel disconnection
    channel.on("system", {}, async (payload) => {
      if (payload.status === "CLOSED" || payload.status === "CHANNEL_ERROR") {
        console.warn("[Realtime] Channel closed, marking as reconnecting");
        setIsReconnecting(true);
        setDisconnectedPlayerId(currentPlayerId);
        setUsePolling(true);
        
        // Notify server about disconnect
        try {
          await handlePlayerDisconnect(matchId, currentPlayerId);
        } catch (error) {
          console.error("[MatchClient] Failed to notify server of disconnect:", error);
        }
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [matchId, usePolling, currentPlayerId, disconnectedPlayerId]);

  useEffect(() => {
    if (!usePolling) {
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const response = await fetch(POLL_ENDPOINT(matchId), {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Polling failed with status ${response.status}`);
        }
        const snapshot = (await response.json()) as MatchState;
        if (isMounted) {
          setMatchState((prev) => ({
            ...prev,
            ...snapshot,
            lastSummary: snapshot.lastSummary ?? prev.lastSummary,
          }));
          setPollError(null);
        }
      } catch (error) {
        console.error("[MatchClient] Polling error", error);
        if (isMounted) {
          setPollError("Connection interrupted. Retrying…");
        }
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
  }, [matchId, pollIntervalMs, usePolling]);

  const currentTimer: TimerState = useMemo(() => {
    if (matchState.timers.playerA.playerId === currentPlayerId) {
      return matchState.timers.playerA;
    }
    return matchState.timers.playerB;
  }, [currentPlayerId, matchState.timers.playerA, matchState.timers.playerB]);

  const timeLeftSeconds = Math.max(0, Math.floor(currentTimer.remainingMs / 1000));
  const isPaused = currentTimer.status !== "running";

  const handleSummaryDismiss = useCallback(() => {
    setSummary(null);
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

      {pollError && (
        <div
          className="mt-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-200"
          data-testid="round-alert"
        >
          {pollError}
        </div>
      )}

      <div className="mt-6 flex w-full flex-col items-center">
        <TimerHud timeLeft={timeLeftSeconds} isPaused={isPaused} roundNumber={matchState.currentRound} />

        <BoardGrid grid={matchState.board} matchId={matchId} />
      </div>

      <RoundSummaryPanel
        summary={summary}
        currentPlayerId={currentPlayerId}
        onDismiss={handleSummaryDismiss}
      />
    </MatchShell>
  );
}

