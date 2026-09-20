"use client";

import { useEffect, useRef } from "react";

import { SETTLE_HOLD_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";

export interface SettleHoldInput {
  matchId?: string;
  /**
   * The round that has just resolved on this client, or null. Not the round the
   * reveal belongs to: a summary and its words arrive in two steps, so between
   * them the reveal reads "nothing to draw, settled", and a hold taken there
   * would expire before the bands did.
   */
  resolvedRound: number | null;
  /** That round's reveal has finished drawing (checked against its own plan). */
  settled: boolean;
}

/**
 * The settle hold (spec 048 FR-022). The round is held from the moment it
 * resolves until `SETTLE_HOLD_MS` after its bands have settled, so the ledger
 * can say `round 4 scored` before the next row opens. A round that scored
 * nothing is held too: the pause is about the round closing, not the bands.
 */
export function useSettleHold({ matchId, resolvedRound, settled }: SettleHoldInput): void {
  const beginHold = useRoomStore((s) => s.beginHold);
  const endHold = useRoomStore((s) => s.endHold);
  const previousMatch = useRef(matchId);
  const heldFor = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previousMatch.current !== matchId) {
      previousMatch.current = matchId;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      heldFor.current = null;
      endHold();
    }
    if (resolvedRound === null || heldFor.current === resolvedRound) return;
    heldFor.current = resolvedRound;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    beginHold(resolvedRound);
    performance.mark?.("room:settle-hold:start", { detail: { round: resolvedRound } });
  }, [matchId, resolvedRound, beginHold, endHold]);

  useEffect(() => {
    // A reveal reads settled before it has planned and again while its words are
    // still arriving, so a pause armed then is cancelled the moment the bands
    // start drawing; the last settle is the one that counts.
    if (!settled) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    if (resolvedRound === null || heldFor.current !== resolvedRound || timer.current) return;
    // Held in a ref, not returned as this effect's cleanup: a re-render with new
    // deps must not cancel a hold that has begun — it would never end.
    timer.current = setTimeout(() => {
      timer.current = null;
      endHold();
      performance.mark?.("room:settle-hold:end", { detail: { round: resolvedRound } });
    }, SETTLE_HOLD_MS);
  }, [settled, resolvedRound, endHold]);

  // On unmount only the timer is cleared; the store's hold is reset by the next
  // `hydrateMatch` / `leaveToLobby`, never by a component leaving.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
}
