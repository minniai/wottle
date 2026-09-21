import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAccumulatedMoves } from "@/components/room/hooks/useAccumulatedMoves";
import type { HistoryWord } from "@/lib/match/wordHistory";
import type { MatchState, MoveResolution, PlayerMatchFacts, WordScore } from "@/lib/types/match";

const A = "a";
const B = "b";
const facts = (playerId: string, over: Partial<PlayerMatchFacts> = {}): PlayerMatchFacts => ({ playerId, movesPlayed: 0, score: 0, inFlight: null, lastResolution: null, ...over });
const word = (playerId: string, text: string): WordScore => ({ playerId, word: text, length: 3, lettersPoints: 5, bonusPoints: 5, totalPoints: 10, coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] });
const resolution = (playerId: string, moveId: string, seq: number, globalSeq: number, words: WordScore[]): MoveResolution => ({
  matchId: "m1", moveId, playerId, globalSeq, seq, status: "resolved", swap: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, board: [], words, delta: 10,
  totals: { playerA: 0, playerB: 0 }, frozenTiles: {}, movesPlayed: { playerA: 0, playerB: 0 }, resolvedAt: "",
});
function state(a: Partial<PlayerMatchFacts> = {}, b: Partial<PlayerMatchFacts> = {}, matchId = "m1"): MatchState {
  return { matchId, board: [], state: "in_progress", players: { playerA: facts(A, a), playerB: facts(B, b) }, clock: { startedAt: null, deadlineAt: null, serverNow: "" }, moveLimit: 10, resolvedSeq: 0, scores: { playerA: 0, playerB: 0 }, frozenTiles: {} };
}
const history: HistoryWord[] = [
  { ...word(A, "borð"), moveSeq: 1, globalSeq: 1 },
  { ...word(B, "gilt"), moveSeq: 1, globalSeq: 2 },
];

/** Spec 047 FR-003, spec 050: history plus both players' latest resolutions, in receipt order. */
describe("useAccumulatedMoves", () => {
  it("folds history and both resolutions together, in receipt order", () => {
    const yours = resolution(A, "mv-3", 2, 3, [word(A, "lek")]);
    const theirs = resolution(B, "mv-4", 2, 4, [word(B, "leg")]);
    const { result } = renderHook(() => useAccumulatedMoves(state({ lastResolution: yours }, { lastResolution: theirs }), history));
    expect(result.current.map((w) => [w.playerId, w.moveSeq, w.word])).toEqual([[A, 1, "borð"], [B, 1, "gilt"], [A, 2, "lek"], [B, 2, "leg"]]);
  });

  it("a resolution replaces what history knew for the same move", () => {
    const yours = resolution(A, "mv-1", 1, 1, [word(A, "borða")]);
    const { result } = renderHook(() => useAccumulatedMoves(state({ lastResolution: yours }), history));
    expect(result.current.filter((w) => w.playerId === A).map((w) => w.word)).toEqual(["borða"]);
  });

  it("a rejected resolution adds nothing", () => {
    const refused: MoveResolution = { ...resolution(A, "mv-9", 1, 9, []), status: "rejected", seq: null, rejectionReason: "frozen" };
    const { result } = renderHook(() => useAccumulatedMoves(state({ lastResolution: refused }), history));
    expect(result.current).toHaveLength(2);
  });

  it("a rematch starts empty", () => {
    const { result, rerender } = renderHook(({ s, h }: { s: MatchState; h: HistoryWord[] | null }) => useAccumulatedMoves(s, h), { initialProps: { s: state(), h: history as HistoryWord[] | null } });
    expect(result.current).toHaveLength(2);
    rerender({ s: state({}, {}, "m2"), h: null });
    expect(result.current).toEqual([]);
  });
});
