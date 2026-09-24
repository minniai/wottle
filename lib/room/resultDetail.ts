import type { Copy } from "@/lib/i18n/copy/types";
import type { MatchEndedReason } from "@/lib/types/match";

/** What the detail line needs to say why a match ended (spec 071 FR-004, GAME_FLOW_SPEC D1). */
export interface DetailFacts {
  endedReason: MatchEndedReason | null | undefined;
  /** Null for a draw. */
  winnerName: string | null;
  loserName: string;
  margin: number;
  /** Winner's count first (either order for a draw). */
  words: [number, number];
  territory: [number, number];
  /** The player short of ten at 0:00, for `incomplete`. */
  short: { name: string; moves: number } | null;
  /** The clock as it read at a resignation (`3:12`), when known. */
  endClock: string | null;
}

/**
 * The detail line's clauses, joined with ` · `; a phone shows the first two. Each reason is said
 * once: whoever was short of ten, resigned, was gone or left comes first, then the margin (a draw
 * has none).
 */
export function resultDetail(facts: DetailFacts, copy: Copy): string[] {
  switch (facts.endedReason) {
    case "forfeit":
      return [copy.forcedDetail(facts.loserName, "forfeit"), ...(facts.endClock ? [facts.endClock] : [])];
    case "ended_early":
      return [copy.ENDED_EARLY, copy.wasGone(facts.loserName)];
    case "abandoned":
    case "disconnect":
      return [copy.forcedDetail(facts.loserName, "disconnect")];
    case "incomplete":
      return withMargin(facts.short ? [copy.incompleteDetail(facts.short.name, facts.short.moves)] : [], facts, copy);
    case "both_incomplete":
      return withMargin([copy.NEITHER_FINISHED], facts, copy);
    default:
      return withMargin([], facts, copy, [copy.wordsDetail(...facts.words), copy.territoryDetail(...facts.territory)]);
  }
}

function withMargin(lead: string[], facts: DetailFacts, copy: Copy, tail: string[] = []): string[] {
  const margin = facts.winnerName === null ? [] : [copy.marginDetail(facts.margin)];
  return [...lead, ...margin, ...tail];
}
