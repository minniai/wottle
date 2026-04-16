"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { LOBBY_STATS_POLL_MS } from "@/lib/constants/lobby";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import type { LobbyMatchesStats } from "@/lib/types/match";

async function fetchMatchesCount(): Promise<number | null> {
  try {
    const response = await fetch(
      "/api/lobby/stats/matches-in-progress",
      { cache: "no-store" },
    );
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as LobbyMatchesStats;
    return typeof body.matchesInProgress === "number"
      ? body.matchesInProgress
      : 0;
  } catch {
    return null;
  }
}

export function LobbyStatsStrip() {
  const players = useLobbyPresenceStore((state) => state.players);
  const connectionMode = useLobbyPresenceStore(
    (state) => state.connectionMode,
  );
  const [matchesInProgress, setMatchesInProgress] = useState<number | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const value = await fetchMatchesCount();
      if (cancelled) {
        return;
      }
      if (value !== null) {
        setMatchesInProgress(value);
      }
    };
    void poll();
    const interval = setInterval(poll, LOBBY_STATS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const onlineCount = players.length;

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-3 font-display text-sm text-text-secondary"
      aria-label="Lobby statistics"
    >
      <span
        data-testid="lobby-stats-online"
        className="flex items-baseline gap-2"
      >
        <strong className="text-3xl font-semibold text-text-primary">
          {onlineCount}
        </strong>
        <span className="text-xs uppercase tracking-[0.25em] text-text-muted">
          {onlineCount === 1 ? "player online" : "players online"}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="h-6 w-px bg-text-muted/25"
      />
      <span
        data-testid="lobby-stats-matches"
        className="flex items-baseline gap-2"
      >
        <strong className="text-3xl font-semibold text-text-primary">
          {matchesInProgress === null ? "—" : matchesInProgress}
        </strong>
        <span className="text-xs uppercase tracking-[0.25em] text-text-muted">
          in match
        </span>
      </span>
      <span className="ml-auto" data-testid="lobby-connection-mode">
        <Badge variant={connectionMode === "realtime" ? "info" : "warning"}>
          {connectionMode === "realtime" ? "Live" : "Polling"}
        </Badge>
      </span>
    </div>
  );
}
