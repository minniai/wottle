"use client";

import { useCallback, useEffect, useRef } from "react";

/** A control that appears or changes meaning ignores activation for 500ms (game flow §5.0, spec 071 FR-002). */
export const ACTIVATION_GUARD_MS = 500;

/**
 * Returns `ready()`: false until 500ms after the control with this `key` appeared. A new key (the
 * control now means something else, e.g. `rematch ▸` became `accept ▸`) starts the wait again.
 */
export function useActivationGuard(key: string): () => boolean {
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [key]);
  return useCallback(() => shownAt.current !== null && Date.now() - shownAt.current >= ACTIVATION_GUARD_MS, []);
}
