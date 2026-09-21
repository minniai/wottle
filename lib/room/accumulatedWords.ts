import type { HistoryWord } from "@/lib/match/wordHistory";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";
import type { MoveResolution, WordScore } from "@/lib/types/match";

/**
 * What the room knows about a match's scored words (spec 047 FR-003, spec 050).
 *
 * `byMove` holds the words of every resolved move, keyed by the mover and
 * their per-player sequence, from the history route or a `move-resolved`
 * broadcast. A resolution always replaces what history knew for its move.
 *
 * `accumulate` returns its input untouched when nothing is new: every poll
 * hands the room a fresh snapshot object, and a new state here would re-render
 * the whole ledger for no information.
 */
export interface AccumulatedWords {
  matchId: string | null;
  byMove: ReadonlyMap<string, AccumulatedWord[]>;
  /** Move ids of the resolutions already folded in. */
  resolutionIds: ReadonlySet<string>;
}

export interface AccumulateInput {
  matchId: string;
  history: HistoryWord[] | null;
  resolutions: (MoveResolution | null | undefined)[];
}

export const EMPTY_WORDS: AccumulatedWords = { matchId: null, byMove: new Map(), resolutionIds: new Set() };

export const moveKey = (playerId: string, seq: number): string => `${playerId}:${seq}`;

export function accumulate(previous: AccumulatedWords, input: AccumulateInput): AccumulatedWords {
  let next = previous.matchId === input.matchId ? previous : { ...EMPTY_WORDS, matchId: input.matchId };
  if (input.history) next = withHistory(next, input.history);
  for (const r of input.resolutions) {
    if (r && r.matchId === input.matchId) next = withResolution(next, r);
  }
  return next;
}

/** Every word in receipt order. */
export function flattenWords(state: AccumulatedWords): AccumulatedWord[] {
  return [...state.byMove.values()].flat().sort((a, b) => a.globalSeq - b.globalSeq || a.word.localeCompare(b.word));
}

/** Moves the history knows and the state does not; moves already held keep their words. */
function withHistory(state: AccumulatedWords, history: HistoryWord[]): AccumulatedWords {
  const fresh = history.filter((w) => w.moveSeq > 0 && !state.byMove.has(moveKey(w.playerId, w.moveSeq)));
  if (fresh.length === 0) return state;
  const byMove = new Map(state.byMove);
  for (const w of fresh) {
    const k = moveKey(w.playerId, w.moveSeq);
    const words = byMove.get(k) ?? [];
    words.push(toAccumulated(w, w.moveSeq, w.globalSeq));
    byMove.set(k, words);
  }
  return { ...state, byMove };
}

function withResolution(state: AccumulatedWords, r: MoveResolution): AccumulatedWords {
  if (r.status !== "resolved" || r.seq === null || state.resolutionIds.has(r.moveId)) return state;
  const byMove = new Map(state.byMove);
  byMove.set(moveKey(r.playerId, r.seq), r.words.map((w) => toAccumulated(w, r.seq as number, r.globalSeq)));
  return { ...state, byMove, resolutionIds: new Set([...state.resolutionIds, r.moveId]) };
}

function toAccumulated(w: WordScore, moveSeq: number, globalSeq: number): AccumulatedWord {
  return {
    playerId: w.playerId,
    moveSeq,
    globalSeq,
    word: w.word,
    totalPoints: w.totalPoints,
    coordinates: w.coordinates,
    direction: w.direction,
  };
}
