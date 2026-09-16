import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAccumulatedRounds } from "@/components/room/hooks/useAccumulatedRounds";
import type { HistoryWord } from "@/lib/match/wordHistory";
import type { MatchState, PartialRoundSummary, RoundSummary, WordScore } from "@/lib/types/match";

/**
 * Spec 047 FR-003 (review S5). The accumulator used to be append-only and keyed
 * on nothing: a rematch kept the previous match's rounds, a reload showed only
 * round N−1, and a first-mover partial outlived the canonical summary that
 * replaced it on the server.
 */
const A = "player-a";
const B = "player-b";
const board = () => Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));

function word(playerId: string, text: string, x: number, y: number): WordScore {
  return {
    playerId, word: text, length: text.length, lettersPoints: 3, bonusPoints: 5, totalPoints: 8,
    coordinates: Array.from({ length: text.length }, (_, i) => ({ x: x + i, y })), direction: "ltr",
  };
}

function summary(matchId: string, roundNumber: number, words: WordScore[]): RoundSummary {
  return { matchId, roundNumber, words, deltas: { playerA: 0, playerB: 0 }, totals: { playerA: 0, playerB: 0 }, highlights: [], resolvedAt: "2026-09-16T00:00:00Z", moves: [] };
}

function partial(matchId: string, roundNumber: number, words: WordScore[]): PartialRoundSummary {
  return { matchId, roundNumber, firstMoverId: A, firstSubmissionAt: "2026-09-16T00:00:01Z", words, delta: { playerA: 0, playerB: 0 }, frozenTiles: {} };
}

function state(matchId: string, overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId, board: board(), currentRound: 1, state: "collecting",
    timers: { playerA: { playerId: A, remainingMs: 300_000, status: "running" }, playerB: { playerId: B, remainingMs: 300_000, status: "running" } },
    scores: { playerA: 0, playerB: 0 }, ...overrides,
  };
}

const HISTORY: HistoryWord[] = [
  { ...word(A, "borð", 0, 0), roundNumber: 1, isDuplicate: false },
  { ...word(B, "gilt", 0, 1), roundNumber: 2, isDuplicate: false },
];
const history = (): HistoryWord[] => HISTORY;

type Props = { match: MatchState; history: HistoryWord[] | null };

function render(initial: Props) {
  return renderHook((p: Props) => useAccumulatedRounds(p.match, p.history), { initialProps: initial });
}

describe("useAccumulatedRounds", () => {
  it("seeds every completed round from the history", () => {
    const { result } = render({ match: state("m1", { currentRound: 3 }), history: history() });
    expect(result.current.map((w) => [w.roundNumber, w.word])).toEqual([[1, "borð"], [2, "gilt"]]);
  });

  it("starts the new match empty when matchId changes (rematch in place)", () => {
    const { result, rerender } = render({ match: state("m1", { currentRound: 3 }), history: history() });
    expect(result.current).toHaveLength(2);
    act(() => rerender({ match: state("m2"), history: null }));
    expect(result.current).toEqual([]);
  });

  it("replaces a first-mover partial with the canonical summary for that round", () => {
    const early = partial("m1", 3, [word(A, "lek", 0, 3)]);
    const { result, rerender } = render({ match: state("m1", { currentRound: 3, partialSummary: early }), history: [] });
    expect(result.current.map((w) => w.word)).toEqual(["lek"]);
    const canonical = summary("m1", 3, [word(A, "leki", 0, 3), word(B, "ost", 5, 3)]);
    act(() => rerender({ match: state("m1", { currentRound: 4, lastSummary: canonical, partialSummary: null }), history: [] }));
    expect(result.current.map((w) => w.word)).toEqual(["leki", "ost"]);
  });

  it("ignores a partial for a round that is already canonical", () => {
    const canonical = summary("m1", 3, [word(A, "leki", 0, 3)]);
    const { result, rerender } = render({ match: state("m1", { currentRound: 4, lastSummary: canonical }), history: [] });
    const late = partial("m1", 3, [word(A, "lek", 0, 3)]);
    act(() => rerender({ match: state("m1", { currentRound: 4, lastSummary: canonical, partialSummary: late }), history: [] }));
    expect(result.current.map((w) => w.word)).toEqual(["leki"]);
  });

  it("does not duplicate a summary that is broadcast twice, and keeps earlier rounds", () => {
    const r1 = summary("m1", 1, [word(A, "borð", 0, 0)]);
    const { result, rerender } = render({ match: state("m1", { currentRound: 2, lastSummary: r1 }), history: null });
    act(() => rerender({ match: state("m1", { currentRound: 2, lastSummary: { ...r1 } }), history: null }));
    expect(result.current).toHaveLength(1);
    const r2 = summary("m1", 2, [word(B, "gilt", 0, 1)]);
    act(() => rerender({ match: state("m1", { currentRound: 3, lastSummary: r2 }), history: null }));
    expect(result.current.map((w) => [w.roundNumber, w.word])).toEqual([[1, "borð"], [2, "gilt"]]);
  });

  it("drops a summary addressed to another match", () => {
    const foreign = summary("m9", 1, [word(A, "borð", 0, 0)]);
    const { result } = render({ match: state("m1", { currentRound: 2, lastSummary: foreign }), history: null });
    expect(result.current).toEqual([]);
  });
});
