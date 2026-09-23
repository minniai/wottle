import type { Verdict } from "./ledgerTypes";
import type { RatingRow } from "./ledgerRows";
import type { RematchPhase } from "./useRematchNegotiation";
import type { ReadySlipModel, VoidSlipModel } from "./tableSlip";

/**
 * The slip (spec 048, design system §5.9): the one element ever laid over the
 * field. One at a time, ranked so a higher-stakes slip
 * always replaces a lower one and is never replaced by it. Spec 050 turned
 * `claim the win` into `end early`: offered only to a player with all their
 * moves whose opponent has been gone for the window.
 */
/** Why the match ended. The verdict's detail line states it; the slip's label counts the match. */
export type EndReason = "moves" | "incomplete" | "resigned" | "abandoned";

export type SlipState =
  | { kind: "signIn" }
  /** Spec 069: the table (C1). Derived from the match, never stored. */
  | { kind: "ready"; model: ReadySlipModel }
  /** Spec 069: the table did not fill, or someone left it (C3). */
  | { kind: "void"; model: VoidSlipModel }
  | { kind: "resign"; move: number; clockMs: number; opponentName: string }
  | { kind: "endEarly"; opponentName: string; opponentMoves: number; clockMs: number }
  | {
      kind: "matchOver";
      verdict: Verdict;
      durationMmSs: string;
      /** Totals by seat; the winner is printed first. */
      scores: { you: number; opp: number };
      viewerName: string;
      opponentName: string;
      ratings: SlipRatingRow[];
      rematch: RematchPhase;
      readOnly: boolean;
    };

export type SlipKind = SlipState["kind"];

/** One rating row on the match-over slip, already resolved to a seat. */
export interface SlipRatingRow {
  seat: "you" | "opp";
  name: string;
  line: string;
  rating?: RatingRow;
}

// Spec 069 (design system §5.9): match over > end early > resign > ready or void.
const RANK: Record<SlipKind, number> = { signIn: 0, ready: 1, void: 1, resign: 2, endEarly: 3, matchOver: 4 };

export function slipPrecedence(kind: SlipKind): number {
  return RANK[kind];
}

/** True when `current` should stay in place instead of being replaced by `next`. */
export function outranks(current: SlipState | null, next: SlipState): boolean {
  if (!current) return false;
  return slipPrecedence(current.kind) > slipPrecedence(next.kind);
}
