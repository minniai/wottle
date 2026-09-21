"use client";

import { railCells, railLabel } from "@/lib/room/moveRail";

interface MoveRailProps {
  movesPlayed: number | null;
  completed: boolean;
}

/**
 * The move rail (spec 048 US3, spec 050): ten cells under the ledger caption
 * counting the viewer's moves — played filled ink, the next one tinted and
 * framed, the rest outlined. One accessible name; the numerals are a
 * progression mark, not a fact for AT.
 */
export function MoveRail({ movesPlayed, completed }: MoveRailProps) {
  return (
    <div className="rail" role="img" aria-label={railLabel(movesPlayed, completed)} data-testid="move-rail">
      {railCells(movesPlayed, completed).map((cell) => (
        <span key={cell.move} className="rail__cell" data-state={cell.state} aria-hidden="true">
          {cell.move}
        </span>
      ))}
    </div>
  );
}
