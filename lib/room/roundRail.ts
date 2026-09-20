import { TOTAL_ROUNDS } from "./ledgerRows";

/** One cell of the round rail (spec 048 US3, design system §5.4). */
export interface RailCell {
  round: number;
  state: "past" | "current" | "future";
}

export function railCells(currentRound: number, completed: boolean, total = TOTAL_ROUNDS): RailCell[] {
  return Array.from({ length: total }, (_, i) => {
    const round = i + 1;
    if (completed || round < currentRound) return { round, state: "past" };
    if (round === currentRound) return { round, state: "current" };
    return { round, state: "future" };
  });
}

/** The rail's one accessible name; its cells are hidden from assistive technology. */
export function railLabel(currentRound: number, completed: boolean, total = TOTAL_ROUNDS): string {
  return completed ? `${total} of ${total} rounds played` : `round ${Math.min(Math.max(currentRound, 1), total)} of ${total}`;
}
