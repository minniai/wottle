import type { Verdict } from "./ledgerTypes";
import type { RatingRow } from "./ledgerRows";
import type { RematchPhase } from "./useRematchNegotiation";

/**
 * The slip (spec 048, design system §5.9): the one element ever laid over the
 * field. Exactly four kinds, one at a time, ranked so a higher-stakes slip
 * always replaces a lower one and is never replaced by it.
 */
export type EndReason = "rounds" | "resigned" | "timeout" | "abandoned";

export type SlipState =
  | { kind: "signIn" }
  | { kind: "resign"; round: number; clockMs: number; opponentName: string }
  | { kind: "claimWin"; opponentName: string; round: number }
  | {
      kind: "matchOver";
      verdict: Verdict;
      reason: EndReason;
      rounds: number;
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

const RANK: Record<SlipKind, number> = { signIn: 0, resign: 1, claimWin: 2, matchOver: 3 };

export function slipPrecedence(kind: SlipKind): number {
  return RANK[kind];
}

/** True when `current` should stay in place instead of being replaced by `next`. */
export function outranks(current: SlipState | null, next: SlipState): boolean {
  if (!current) return false;
  return slipPrecedence(current.kind) > slipPrecedence(next.kind);
}
