import type { Copy } from "@/lib/i18n/copy/types";
import type { ReviewStep } from "@/lib/types/review";

import type { ReviewNames } from "./stepFacts";

export type CellState = "reached" | "current" | "ahead";
type Slot = "player_a" | "player_b";

/** Spec 071 (FR-036): every counted move, keyed `slot:move`, reached, current or not yet reached at step k. */
export function ledgerCellStates(steps: ReviewStep[], k: number): Map<string, CellState> {
  const states = new Map<string, CellState>();
  for (const step of steps) {
    if (step.kind !== "move" || !step.slot || step.moveNumber === null) continue;
    states.set(`${step.slot}:${step.moveNumber}`, step.index < k ? "reached" : step.index === k ? "current" : "ahead");
  }
  return states;
}

/** The step a ledger cell jumps to, or null for a move never played. */
export function stepOfCell(steps: ReviewStep[], slot: Slot, move: number): number | null {
  return steps.find((s) => s.kind === "move" && s.slot === slot && s.moveNumber === move)?.index ?? null;
}

/** `move 8, Kári, not yet reached`: a muted cell is named, not only greyed (FR-036). */
export function cellName(slot: Slot, move: number, names: ReviewNames, state: CellState, copy: Copy): string {
  const name = copy.review.cellName(move, slot === "player_a" ? names.a : names.b);
  return state === "ahead" ? `${name}, ${copy.review.NOT_YET_REACHED}` : name;
}

/**
 * The ledger row the cursor line takes at a step: the mover's move, or for the closing step the
 * first row with a move not played. Null when there is none (a refusal keeps no row of its own).
 */
export function cursorRow(step: ReviewStep, moveLimit: number): { slot: Slot | null; move: number } | null {
  if (step.kind === "move" && step.slot && step.moveNumber !== null) return { slot: step.slot, move: step.moveNumber };
  if (step.kind !== "closing") return null;
  const first = Math.min(step.movesPlayed.a, step.movesPlayed.b) + 1;
  return first <= moveLimit ? { slot: null, move: first } : null;
}
