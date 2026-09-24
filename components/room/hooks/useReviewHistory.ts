"use client";

import { useCallback, useRef } from "react";

/**
 * Spec 071 (FR-030, R4): review lives at `?review=n` on the match page. Entering it adds one
 * history entry; each step replaces it; leaving goes back to the result. The native History API
 * is used because the App Router keeps `useSearchParams` in step with it, so nothing remounts.
 */
export function useReviewHistory(): {
  enter: (step: number | "last") => void;
  stepTo: (step: number) => void;
  leave: () => void;
  correct: (canonical: string) => void;
  drop: () => void;
} {
  const entered = useRef(false);
  const urlWith = (step: string | null): string => {
    const url = new URL(window.location.href);
    if (step === null) url.searchParams.delete("review");
    else url.searchParams.set("review", step);
    return `${url.pathname}${url.search}${url.hash}`;
  };
  // Only our own keys: the App Router copies its internals itself, and a state that already carries
  // them (`__NA`) is taken as the router's own call and not synced into `useSearchParams`.
  const state = (kind: "review" | "result") => ({ kind });
  const currentKind = (): "review" | "result" => ((window.history.state as { kind?: string } | null)?.kind === "review" ? "review" : "result");

  const enter = useCallback((step: number | "last") => {
    entered.current = true;
    window.history.pushState(state("review"), "", urlWith(String(step)));
  }, []);
  const stepTo = useCallback((step: number) => window.history.replaceState(state("review"), "", urlWith(String(step))), []);
  const correct = useCallback((canonical: string) => window.history.replaceState(state(currentKind()), "", urlWith(canonical)), []);
  const drop = useCallback(() => window.history.replaceState(state(currentKind()), "", urlWith(null)), []);
  const leave = useCallback(() => {
    if (entered.current) {
      entered.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState(state("result"), "", urlWith(null));
  }, []);
  return { enter, stepTo, leave, correct, drop };
}
