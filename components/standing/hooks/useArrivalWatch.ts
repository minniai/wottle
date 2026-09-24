"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LobbyRow } from "@/lib/types/standing";

export interface ArrivalWatch {
  armed: boolean;
  arm: () => void;
  cancel: () => void;
}

/**
 * `tell me when someone is here ▸` (spec 070 US2.6, clarification Q4): armed in
 * an empty lobby, the first player to arrive is announced once, and the watch
 * ends. Pressing it again in a later empty lobby arms it again.
 */
export function useArrivalWatch(rows: LobbyRow[], onArrive: (name: string) => void): ArrivalWatch {
  const [armed, setArmed] = useState(false);
  const announce = useRef(onArrive);
  useEffect(() => {
    announce.current = onArrive;
  }, [onArrive]);
  const first = rows[0]?.displayName ?? null;
  useEffect(() => {
    if (!armed || !first) return;
    setArmed(false);
    announce.current(first);
  }, [armed, first]);
  const arm = useCallback(() => setArmed(true), []);
  const cancel = useCallback(() => setArmed(false), []);
  return { armed, arm, cancel };
}
