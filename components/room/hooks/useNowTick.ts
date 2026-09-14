"use client";

import { useEffect, useState } from "react";

/** Wall-clock `now` that re-renders every `intervalMs` while `active` (countdowns such as the reconnection window). */
export function useNowTick(active: boolean, intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
