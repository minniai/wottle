import type { HistoryWord } from "@/lib/match/wordHistory";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";
import type { PartialRoundSummary, RoundSummary, WordScore } from "@/lib/types/match";

/**
 * What the room knows about a match's scored words (spec 047 FR-003).
 *
 * `canonical` holds one entry per completed round, from the history route or
 * the round's summary broadcast. `partial` holds the live round's first-mover
 * words until the canonical summary for that round replaces them — the server
 * deletes and rewrites those rows, so the client must too.
 */
export interface AccumulatedWords {
  matchId: string | null;
  canonical: ReadonlyMap<number, AccumulatedWord[]>;
  partial: { round: number; words: AccumulatedWord[] } | null;
}

export interface AccumulateInput {
  matchId: string;
  history: HistoryWord[] | null;
  lastSummary: RoundSummary | null | undefined;
  partialSummary: PartialRoundSummary | null | undefined;
}

export const EMPTY_WORDS: AccumulatedWords = { matchId: null, canonical: new Map(), partial: null };

export function accumulate(previous: AccumulatedWords, input: AccumulateInput): AccumulatedWords {
  let next = previous.matchId === input.matchId ? previous : { ...EMPTY_WORDS, matchId: input.matchId };
  if (input.history) next = withHistory(next, input.history);
  if (input.lastSummary?.matchId === input.matchId) next = withSummary(next, input.lastSummary);
  if (input.partialSummary?.matchId === input.matchId) next = withPartial(next, input.partialSummary);
  return next;
}

/** Canonical rounds in order, then the live round's partial words. */
export function flattenWords(state: AccumulatedWords): AccumulatedWord[] {
  const rounds = [...state.canonical.keys()].sort((a, b) => a - b);
  const settled = rounds.flatMap((round) => state.canonical.get(round) ?? []);
  return state.partial ? [...settled, ...state.partial.words] : settled;
}

function withHistory(state: AccumulatedWords, history: HistoryWord[]): AccumulatedWords {
  const canonical = new Map(state.canonical);
  for (const w of history) {
    if (canonical.has(w.roundNumber)) continue;
    canonical.set(w.roundNumber, []);
  }
  for (const w of history) {
    if (state.canonical.has(w.roundNumber)) continue;
    canonical.get(w.roundNumber)?.push(toAccumulated(w, w.roundNumber, w.isDuplicate));
  }
  return { ...state, canonical };
}

function withSummary(state: AccumulatedWords, summary: RoundSummary): AccumulatedWords {
  const canonical = new Map(state.canonical);
  canonical.set(summary.roundNumber, summary.words.map((w) => toAccumulated(w, summary.roundNumber)));
  const partial = state.partial && state.partial.round <= summary.roundNumber ? null : state.partial;
  return { ...state, canonical, partial };
}

function withPartial(state: AccumulatedWords, partial: PartialRoundSummary): AccumulatedWords {
  if (state.canonical.has(partial.roundNumber)) return state;
  const words = partial.words.map((w) => toAccumulated(w, partial.roundNumber));
  return { ...state, partial: { round: partial.roundNumber, words } };
}

function toAccumulated(w: WordScore, roundNumber: number, isDuplicate?: boolean): AccumulatedWord {
  return {
    roundNumber,
    playerId: w.playerId,
    word: w.word,
    totalPoints: w.totalPoints,
    coordinates: w.coordinates,
    direction: w.direction,
    ...(isDuplicate ? { isDuplicate } : {}),
  };
}
