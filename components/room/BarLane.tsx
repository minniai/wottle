"use client";

import type { CSSProperties } from "react";

import { TOTAL_MOVES } from "@/lib/room/ledgerRows";

export type LaneMode = "moves" | "searching" | "disconnected" | "empty";

interface BarLaneProps {
  /** Accessible name of the progressbar (`your moves` / `opponent's moves`). */
  label: string;
  movesPlayed: number;
  moveLimit?: number;
  mode?: LaneMode;
}

/**
 * The bar's edge nearest the field (design system §5.3, spec 050): full width
 * = ten moves, the filled part is the moves played, in the seat colour.
 * Disconnected it is dashed; searching it carries a travelling segment.
 */
export function BarLane({ label, movesPlayed, moveLimit = TOTAL_MOVES, mode = "moves" }: BarLaneProps) {
  const fraction = mode === "empty" ? 0 : Math.min(1, Math.max(0, movesPlayed / moveLimit));
  const className = [
    "player-bar__lane",
    mode === "disconnected" ? "player-bar__lane--disconnected" : "",
    mode === "searching" ? "player-bar__lane--searching" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const valueText = mode === "searching" ? "searching" : `${movesPlayed} of ${moveLimit} moves played`;

  return (
    <div
      className={className}
      data-testid="player-bar-lane"
      data-mode={mode}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={moveLimit}
      aria-valuenow={mode === "searching" ? undefined : movesPlayed}
      aria-valuetext={valueText}
      style={{ "--lane-fraction": fraction } as CSSProperties}
    >
      {mode === "disconnected" ? (
        /* The design's 6px/4px pattern. A CSS dashed border would be whatever
           the browser chooses — about 12/12 in Chrome (spec 045 FR-029). */
        <svg className="player-bar__lane-dash" width="100%" height="4" aria-hidden="true">
          <line x1="0" y1="2" x2="100%" y2="2" stroke="var(--seat-ink)" strokeWidth="4" strokeDasharray="6 4" />
        </svg>
      ) : (
        <div className="player-bar__lane-fill" />
      )}
    </div>
  );
}
