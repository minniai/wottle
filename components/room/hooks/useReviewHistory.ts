"use client";

import { useCallback, useRef } from "react";

/**
 * Spec 071 (FR-030, R4): review lives at `?review=n` on the match page. Entering it adds one
 * history entry; each step replaces it; leaving goes back to the result. The native History API
 * is used because the App Router keeps `useSearchParams` in step with it, so nothing remounts.
 */
export function useReviewHistory(): {
  enter: (step: number) => void;
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
  const state = (kind: "review" | "result") => ({ ...(window.history.state as object | null), kind });

  const enter = useCallback((step: number) => {
    entered.current = true;
    window.history.pushState(state("review"), "", urlWith(String(step)));
  }, []);
  const stepTo = useCallback((step: number) => window.history.replaceState(state("review"), "", urlWith(String(step))), []);
  const correct = useCallback((canonical: string) => window.history.replaceState(window.history.state, "", urlWith(canonical)), []);
  const drop = useCallback(() => window.history.replaceState(window.history.state, "", urlWith(null)), []);
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
