"use client";

import { useEffect, useRef } from "react";

import { ACTIVATION_GUARD_MS } from "@/lib/presence/constants";

/**
 * A control that appears or changes meaning ignores activation for 500ms
 * (game flow §5.0 guards, spec 070 FR-015). Returns a check to call in the
 * handler: false while the guard holds. `meaning` is whatever the control now
 * means; a change re-arms the guard.
 */
export function useActivationGuard(meaning: unknown): () => boolean {
  const armedAt = useRef(0);
  useEffect(() => {
    armedAt.current = Date.now();
  }, [meaning]);
  return () => Date.now() - armedAt.current >= ACTIVATION_GUARD_MS;
}
