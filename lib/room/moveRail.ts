import { TOTAL_MOVES } from "./ledgerRows";

/** One cell of the move rail (spec 048 US3, spec 050; design system §5.4): the viewer's moves. */
export interface RailCell {
  move: number;
  state: "past" | "current" | "future";
}

/** `movesPlayed` null: no match yet (the queue) — every cell is future. */
export function railCells(movesPlayed: number | null, completed: boolean, total = TOTAL_MOVES): RailCell[] {
  return Array.from({ length: total }, (_, i) => {
    const move = i + 1;
    if (completed || (movesPlayed !== null && move <= movesPlayed)) return { move, state: "past" };
    if (movesPlayed !== null && move === movesPlayed + 1) return { move, state: "current" };
    return { move, state: "future" };
  });
}

/** The rail's one accessible name; its cells are hidden from assistive technology. */
export function railLabel(movesPlayed: number | null, completed: boolean, total = TOTAL_MOVES): string {
  if (movesPlayed === null && !completed) return `${total} moves each`;
  if (completed || (movesPlayed ?? 0) >= total) return `${total} of ${total} played`;
  return `move ${Math.min(Math.max((movesPlayed ?? 0) + 1, 1), total)} of ${total}`;
}
