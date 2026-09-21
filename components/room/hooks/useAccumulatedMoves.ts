"use client";

import { useEffect, useMemo, useState } from "react";

import type { HistoryWord } from "@/lib/match/wordHistory";
import { accumulate, EMPTY_WORDS, flattenWords, type AccumulatedWords } from "@/lib/room/accumulatedWords";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";
import type { MatchState } from "@/lib/types/match";

/**
 * Every scored word of the match the room is showing, from the history route
 * and both players' latest resolutions (spec 047 FR-003, spec 050).
 *
 * Keyed on `matchId`: a rematch replaces the match in place and starts empty.
 */
export function useAccumulatedMoves(match: MatchState, history: HistoryWord[] | null): AccumulatedWord[] {
  const [state, setState] = useState<AccumulatedWords>(EMPTY_WORDS);
  const { matchId } = match;
  const yours = match.players.playerA.lastResolution;
  const theirs = match.players.playerB.lastResolution;

  useEffect(() => {
    setState((previous) => accumulate(previous, { matchId, history, resolutions: [yours, theirs] }));
  }, [matchId, history, yours, theirs]);

  return useMemo(() => (state.matchId === matchId ? flattenWords(state) : []), [state, matchId]);
}
