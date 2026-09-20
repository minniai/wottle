"use client";

import { railCells, railLabel } from "@/lib/room/roundRail";

interface RoundRailProps {
  currentRound: number;
  completed: boolean;
}

/**
 * The round rail (spec 048 US3): ten cells under the ledger caption — past
 * filled ink, the current one tinted and framed, the rest outlined. One
 * accessible name; the numerals are a progression mark, not a fact for AT.
 */
export function RoundRail({ currentRound, completed }: RoundRailProps) {
  return (
    <div className="rail" role="img" aria-label={railLabel(currentRound, completed)} data-testid="round-rail">
      {railCells(currentRound, completed).map((cell) => (
        <span key={cell.round} className="rail__cell" data-state={cell.state} aria-hidden="true">
          {cell.round}
        </span>
      ))}
    </div>
  );
}
