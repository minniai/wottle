"use client";

import { useEffect, useState } from "react";

import type { MatchState } from "@/lib/types/match";

export interface ClockReadings {
  playerA: number;
  playerB: number;
}

function readClocks(timers: MatchState["timers"] | null, snapshotAt: number, now: number): ClockReadings {
  if (!timers) return { playerA: 0, playerB: 0 };
  const elapsed = Math.max(0, now - snapshotAt);
  const tick = (t: MatchState["timers"]["playerA"]) =>
    Math.max(0, t.status === "running" ? t.remainingMs - elapsed : t.remainingMs);
  return { playerA: tick(timers.playerA), playerB: tick(timers.playerB) };
}

/**
 * Client-side 1 s tick of the server-authoritative clocks: each snapshot's
 * `remainingMs` is the anchor and only `running` clocks drain. Ported from
 * MatchClient's timerTick; the server remains the authority on expiry.
 */
export function useClockTick(timers: MatchState["timers"] | null, intervalMs = 1_000): ClockReadings {
  const [snapshotAt, setSnapshotAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const at = Date.now();
    setSnapshotAt(at);
    setNow(at);
  }, [timers]);

  useEffect(() => {
    const anyRunning = timers?.playerA.status === "running" || timers?.playerB.status === "running";
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [timers, intervalMs]);

  return readClocks(timers, snapshotAt, now);
}
