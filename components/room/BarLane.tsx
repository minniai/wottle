"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";

export type LaneMode = "moves" | "searching" | "disconnected" | "empty";

interface BarLaneProps {
  /** Accessible name of the progressbar (`your moves` / `opponent's moves`). */
  label: string;
  movesPlayed: number;
  moveLimit?: number;
  /** A move of this player's is received and not yet resolved. */
  moveInFlight?: boolean;
  mode?: LaneMode;
}

type SegmentState = "left" | "scoring" | "spent";

/** The segments in reading order: the moves left first, the spent ones after. */
function segmentStates(movesPlayed: number, moveLimit: number, moveInFlight: boolean): SegmentState[] {
  const left = Math.max(0, moveLimit - movesPlayed);
  return Array.from({ length: moveLimit }, (_, i) => {
    if (i >= left) return "spent";
    return moveInFlight && i === left - 1 ? "scoring" : "left";
  });
}

/**
 * The bar's edge nearest the field (design system §5.3; 2026-09-21): ten
 * segments, one per move this player has left, in the seat colour. A resolved
 * move empties the rightmost; one in flight shows at 30% until it resolves.
 * Disconnected, the moves left are outlined; searching, a segment travels.
 */
export function BarLane({ label, movesPlayed, moveLimit = TOTAL_MOVES, moveInFlight = false, mode = "moves" }: BarLaneProps) {
  const { SEARCHING, movesLeft } = useCopy();
  const segmented = mode === "moves" || mode === "disconnected";
  const left = Math.max(0, moveLimit - movesPlayed);
  const className = [
    "player-bar__lane",
    segmented ? "player-bar__lane--segments" : "",
    mode === "disconnected" ? "player-bar__lane--disconnected" : "",
    mode === "searching" ? "player-bar__lane--searching" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const valueText = mode === "searching" ? SEARCHING : movesLeft(left, moveLimit);

  return (
    <div
      className={className}
      data-testid="player-bar-lane"
      data-mode={mode}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={moveLimit}
      aria-valuenow={mode === "searching" ? undefined : left}
      aria-valuetext={valueText}
    >
      {segmented
        ? segmentStates(movesPlayed, moveLimit, moveInFlight).map((state, i) => <span key={i} className="player-bar__segment" data-state={state} />)
        : mode === "searching"
          ? <div className="player-bar__lane-fill" />
          : null}
    </div>
  );
}
