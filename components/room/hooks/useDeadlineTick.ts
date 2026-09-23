"use client";

import { useEffect, useState } from "react";

import { remainingFromDeadline, serverCorrectedNow } from "@/lib/room/clock";
import type { MatchClock } from "@/lib/types/match";

/**
 * Client-side 1s tick of the one shared clock (spec 050): every snapshot's
 * `deadlineAt` and `serverNow` re-anchor it, so drift corrects on the next
 * poll; it never pauses. The server remains the authority on the deadline.
 */
export function useDeadlineTick(clock: MatchClock | null, intervalMs = 1_000): number {
  const [anchor, setAnchor] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const deadlineAt = clock?.deadlineAt ?? null;
  const serverNow = clock?.serverNow ?? null;

  useEffect(() => {
    const at = Date.now();
    setAnchor(at);
    setNow(at);
  }, [deadlineAt, serverNow]);

  useEffect(() => {
    if (!deadlineAt) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [deadlineAt, intervalMs]);

  if (!clock) return 0;
  return remainingFromDeadline({ deadlineAt, serverNow: serverNow ?? new Date(anchor).toISOString() }, anchor, now);
}

/**
 * How far the device clock is behind the server's, measured when each snapshot
 * lands (spec 068 R9): server timestamps such as `disconnectedAt` are compared
 * against `Date.now() + drift`, never the device clock alone.
 */
export function useServerDrift(clock: MatchClock | null): number {
  const [drift, setDrift] = useState(0);
  const serverNow = clock?.serverNow ?? null;
  useEffect(() => {
    if (serverNow) setDrift(serverCorrectedNow(serverNow, Date.now(), 0));
  }, [serverNow]);
  return drift;
}
