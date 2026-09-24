import type { Copy } from "@/lib/i18n/copy/types";
import { formatClock, MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import { stakesFor } from "@/lib/rating/stakes";

export interface ComposerFacts {
  viewer: { rating: number; gamesPlayed: number };
  opponent: { rating: number };
  /** The viewer's search is running: sending cancels it. */
  searching: boolean;
  /** The viewer has a challenge out: sending withdraws it. */
  outgoing: boolean;
  /** A call is up: it outranks the send (US3.2). */
  callUp: boolean;
}

export interface ComposerModel {
  /** One line on a desktop, two on a phone (F6). */
  terms: string[];
  consequence: string | null;
  sendDrawnAs: "primary" | "secondary";
}

/**
 * The composer (spec 070 US3.1, game flow B2): the terms of the match and the
 * viewer's rating change for each outcome against this opponent, computed by
 * the settlement's own rule, and what sending would cancel.
 */
export function composerModel(facts: ComposerFacts, copy: Copy, layout: "desktop" | "phone"): ComposerModel {
  const stakes = stakesFor(
    { eloRating: facts.viewer.rating, gamesPlayed: facts.viewer.gamesPlayed, wins: 0, losses: 0, draws: 0 },
    { eloRating: facts.opponent.rating, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
  );
  const words = copy.LANGUAGE_WORDS;
  const terms =
    layout === "phone"
      ? copy.pages.composerTermsPhone(stakes.win, stakes.draw, stakes.loss, words, TOTAL_MOVES)
      : [copy.pages.composerTerms(stakes.win, stakes.draw, stakes.loss, words, TOTAL_MOVES, formatClock(MATCH_CLOCK_BUDGET_MS))];
  const consequence = facts.searching ? copy.pages.SENDING_CANCELS_SEARCH : facts.outgoing ? copy.pages.SENDING_WITHDRAWS_OTHER : null;
  return { terms, consequence, sendDrawnAs: facts.callUp ? "secondary" : "primary" };
}
