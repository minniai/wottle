"use client";

import { useCallback, useEffect, useRef } from "react";

const GUARD = { kind: "guard" } as const;

type EntryKind = "guard" | "table-guard" | "result" | "review";

function entryKind(): EntryKind | undefined {
  return (window.history.state as { kind?: EntryKind } | null)?.kind;
}

/** Mark the current entry, keeping whatever the router stored in it (spec 071 R4: guard → result → review). */
export function markEntry(kind: EntryKind): void {
  window.history.replaceState({ ...(window.history.state as object | null), kind }, "");
}

/**
 * Back in a live match (spec 070 US8, FR-041, FR-043; game flow §4 history
 * policy). The first pick is a user activation, so a guard entry pushed then
 * is kept by the browser; Back pops it, the leave slip rises and the guard
 * goes back. A return to the match finds its guard already there. Closing
 * the tab asks while the match is live. Once it completes, nothing is caught:
 * the guard is stepped off and the entry becomes the result, so one Back from
 * the result reaches the lobby (spec 071 FR-007).
 */
export function useLiveBackGuard({ live, completed = false, onBack }: { live: boolean; completed?: boolean; onBack: () => void }): { release: () => void } {
  const armed = useRef(live);
  const back = useRef(onBack);
  const pushed = useRef(false);
  const leavingGuard = useRef(false);
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
      if (leavingGuard.current) {
        leavingGuard.current = false;
        markEntry("result");
        return;
      }
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

  useEffect(() => {
    if (!completed) return;
    armed.current = false;
    if (entryKind() === GUARD.kind) {
      leavingGuard.current = true;
      window.history.go(-1);
    } else if (entryKind() !== "review") {
      markEntry("result");
    }
  }, [completed]);

  const release = useCallback(() => {
    armed.current = false;
  }, []);
  return { release };
}
