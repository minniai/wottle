"use client";

import { useEffect } from "react";

interface Sentinel {
  release: () => Promise<void>;
}

type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };

/**
 * Keeps a phone's screen awake while `active` (spec 069 FR-029): at the table
 * and while searching, when a sleeping screen would miss the 20s to sit down.
 * Coarse pointers only; feature-detected. The browser drops the lock when the
 * tab is hidden, so it is taken again when the tab comes back.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = (navigator as WakeLockNavigator).wakeLock;
    if (!active || !api || !window.matchMedia?.("(pointer: coarse)").matches) return;
    let sentinel: Sentinel | null = null;
    let live = true;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      void api.request("screen").then((s) => (live ? (sentinel = s) : void s.release()), () => undefined);
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", take);
      void sentinel?.release();
    };
  }, [active]);
}
