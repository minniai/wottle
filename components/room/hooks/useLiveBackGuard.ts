"use client";

import { useCallback, useEffect, useRef } from "react";

const GUARD = { kind: "guard" } as const;

/**
 * Back in a live match (spec 070 US8, FR-041, FR-043; game flow §4 history
 * policy). The first pick is a user activation, so a guard entry pushed then
 * is kept by the browser; Back pops it, the leave slip rises and the guard
 * goes back. A return to the match finds its guard already there. Closing
 * the tab asks while the match is live. Once it completes, nothing is caught.
 */
export function useLiveBackGuard({ live, onBack }: { live: boolean; onBack: () => void }): { release: () => void } {
  const armed = useRef(live);
  const back = useRef(onBack);
  const pushed = useRef(false);
  useEffect(() => {
    armed.current = live;
    back.current = onBack;
  }, [live, onBack]);

  useEffect(() => {
    if (!live) return;
    const onPick = () => {
      if (pushed.current || !armed.current) return;
      pushed.current = true;
      if ((window.history.state as { kind?: string } | null)?.kind === GUARD.kind) return;
      window.history.pushState(GUARD, "");
    };
    window.addEventListener("pointerdown", onPick, { passive: true });
    window.addEventListener("keydown", onPick);
    return () => {
      window.removeEventListener("pointerdown", onPick);
      window.removeEventListener("keydown", onPick);
    };
  }, [live]);

  useEffect(() => {
    const onPop = () => {
      if (!armed.current || !pushed.current) return;
      window.history.pushState(GUARD, "");
      back.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!live) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!armed.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [live]);

  const release = useCallback(() => {
    armed.current = false;
  }, []);
  return { release };
}
