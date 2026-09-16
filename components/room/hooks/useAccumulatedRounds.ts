"use client";

import { useEffect, useMemo, useState } from "react";

import type { HistoryWord } from "@/lib/match/wordHistory";
import { accumulate, EMPTY_WORDS, flattenWords, type AccumulatedWords } from "@/lib/room/accumulatedWords";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";
import type { MatchState } from "@/lib/types/match";

/**
 * Every scored word of the match the room is showing, from the history route
 * (completed rounds), the summary broadcast (the round that just resolved) and
 * the instant first-mover partial (the live round) — spec 047 FR-003.
 *
 * Keyed on `matchId`: a rematch replaces the match in place and starts empty.
 * A partial never outlives the canonical summary for its round.
 */
export function useAccumulatedRounds(match: MatchState, history: HistoryWord[] | null): AccumulatedWord[] {
  const [state, setState] = useState<AccumulatedWords>(EMPTY_WORDS);
  const { matchId, lastSummary, partialSummary } = match;

  useEffect(() => {
    setState((previous) => accumulate(previous, { matchId, history, lastSummary, partialSummary }));
  }, [matchId, history, lastSummary, partialSummary]);

  return useMemo(() => (state.matchId === matchId ? flattenWords(state) : []), [state, matchId]);
}
