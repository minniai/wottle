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
  /** Spec 069: the table (C1). Derived from the match, never stored. */
  | { kind: "ready"; model: ReadySlipModel }
  /** Spec 069: the table did not fill, or someone left it (C3). */
  | { kind: "void"; model: VoidSlipModel }
  /** `loss`: the viewer's loss stake, kept from the table (spec 069 US8); absent after a mid-match reload. */
  | { kind: "resign"; move: number; clockMs: number; opponentName: string; loss?: number }
  /** Spec 070 (C7): Back or `⋯ go to the lobby` in a live match. Never resigns; the clock keeps running. */
  | { kind: "leave"; move: number; limit: number; clockMs: number }
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

// Spec 070 (design system §5.9, §8 item 2): match over > end early > resign > leave > ready or void.
const RANK: Record<SlipKind, number> = { ready: 1, void: 1, leave: 2, resign: 3, endEarly: 4, matchOver: 5 };

export function slipPrecedence(kind: SlipKind): number {
  return RANK[kind];
}

/** True when `current` should stay in place instead of being replaced by `next`. */
export function outranks(current: SlipState | null, next: SlipState): boolean {
  if (!current) return false;
  return slipPrecedence(current.kind) > slipPrecedence(next.kind);
}
