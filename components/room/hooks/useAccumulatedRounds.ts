"use client";

import { useEffect, useRef, useState } from "react";

import type { AccumulatedWord } from "@/lib/room/ledgerRows";
import type { MatchState, PartialRoundSummary, RoundSummary } from "@/lib/types/match";

function fromSummary(summary: RoundSummary): AccumulatedWord[] {
  return summary.words.map((w) => ({
    roundNumber: summary.roundNumber,
    playerId: w.playerId,
    word: w.word,
    totalPoints: w.totalPoints,
    coordinates: w.coordinates,
    direction: w.direction,
  }));
}

function fromPartial(partial: PartialRoundSummary): AccumulatedWord[] {
  return partial.words.map((w) => ({
    roundNumber: partial.roundNumber,
    playerId: w.playerId,
    word: w.word,
    totalPoints: w.totalPoints,
    coordinates: w.coordinates,
    direction: w.direction,
  }));
}

const wordKey = (w: AccumulatedWord) => `${w.roundNumber}:${w.playerId}:${w.word}:${w.coordinates[0]?.x},${w.coordinates[0]?.y}`;

/**
 * Words accumulated across rounds from every delivery path (summary broadcast,
 * state snapshot's lastSummary, instant first-mover partial). Deduped by round +
 * player + word + start tile, so a repeated broadcast never doubles a row.
 */
export function useAccumulatedRounds(match: MatchState | null): AccumulatedWord[] {
  const [words, setWords] = useState<AccumulatedWord[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const incoming = [
      ...(match?.lastSummary ? fromSummary(match.lastSummary) : []),
      ...(match?.partialSummary ? fromPartial(match.partialSummary) : []),
    ].filter((w) => !seen.current.has(wordKey(w)));
    if (incoming.length === 0) return;
    incoming.forEach((w) => seen.current.add(wordKey(w)));
    setWords((prev) => [...prev, ...incoming]);
  }, [match?.lastSummary, match?.partialSummary]);

  return words;
}
