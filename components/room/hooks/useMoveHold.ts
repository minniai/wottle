"use client";

import { useEffect, useRef } from "react";

import { MOVE_HOLD_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";

export interface MoveHoldInput {
  matchId?: string;
  /**
   * The viewer's move that has just resolved on this client, or null. Keyed by
   * the move id: a resolution and its words arrive in two steps, so between
   * them the reveal reads "nothing to draw, settled", and a hold taken there
   * would expire before the bands did.
   */
  resolved: { moveId: string; seq: number } | null;
  /** That move's reveal has finished drawing (checked against its own plan). */
  settled: boolean;
}

/**
 * The move hold (spec 050 FR-013). The viewer's move is held from the moment
 * it resolves until `MOVE_HOLD_MS` after its bands have settled, so the ledger
 * can say `move 4 scored` before the next opens. A move that scored nothing
 * is held too: the pause is about the move closing, not the bands.
 */
export function useMoveHold({ matchId, resolved, settled }: MoveHoldInput): void {
  const beginHold = useRoomStore((s) => s.beginHold);
  const endHold = useRoomStore((s) => s.endHold);
  const previousMatch = useRef(matchId);
  const heldFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveId = resolved?.moveId ?? null;
  const seq = resolved?.seq ?? null;

  useEffect(() => {
    if (previousMatch.current !== matchId) {
      previousMatch.current = matchId;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      heldFor.current = null;
      endHold();
    }
    if (moveId === null || seq === null || heldFor.current === moveId) return;
    heldFor.current = moveId;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    beginHold(seq);
    performance.mark?.("room:move-hold:start", { detail: { move: seq } });
  }, [matchId, moveId, seq, beginHold, endHold]);

  useEffect(() => {
    // A reveal reads settled before it has planned and again while its words are
    // still arriving, so a pause armed then is cancelled the moment the bands
    // start drawing; the last settle is the one that counts.
    if (!settled) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    if (moveId === null || heldFor.current !== moveId || timer.current) return;
    // Held in a ref, not returned as this effect's cleanup: a re-render with new
    // deps must not cancel a hold that has begun — it would never end.
    timer.current = setTimeout(() => {
      timer.current = null;
      endHold();
      performance.mark?.("room:move-hold:end", { detail: { move: seq } });
    }, MOVE_HOLD_MS);
  }, [settled, moveId, seq, endHold]);

  // On unmount only the timer is cleared; the store's hold is reset by the next
  // `hydrateMatch` / `leaveToLobby`, never by a component leaving.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
}
