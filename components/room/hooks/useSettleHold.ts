"use client";

import { useEffect, useRef } from "react";

import { SETTLE_HOLD_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";

export interface SettleHoldInput {
  /** The round the running (or last) reveal belongs to. */
  round: number | null;
  settled: boolean;
  /** The plan drew at least one band; a settle-only plan holds nothing. */
  drew: boolean;
}

/**
 * The settle hold (spec 048 FR-022): when a reveal that drew something settles,
 * the scored row stays the tinted row for `SETTLE_HOLD_MS` before the next live
 * row opens. Keyed on the `settled` edge because `useReveal` has no callback.
 */
export function useSettleHold({ round, settled, drew }: SettleHoldInput): void {
  const beginHold = useRoomStore((s) => s.beginHold);
  const endHold = useRoomStore((s) => s.endHold);
  const wasSettled = useRef(settled);
  const heldFor = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rose = settled && !wasSettled.current;
    wasSettled.current = settled;
    if (!rose || !drew || round === null || heldFor.current === round) return;
    heldFor.current = round;
    beginHold(round);
    performance.mark?.("room:settle-hold:start", { detail: { round } });
    // Held in a ref, not returned as this effect's cleanup: a re-render with new
    // deps must not cancel a hold that has begun — it would never end.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      endHold();
      performance.mark?.("room:settle-hold:end", { detail: { round } });
    }, SETTLE_HOLD_MS);
  }, [settled, drew, round, beginHold, endHold]);

  // On unmount only the timer is cleared; the store's hold is reset by the next
  // `hydrateMatch` / `leaveToLobby`, never by a component leaving.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
}
