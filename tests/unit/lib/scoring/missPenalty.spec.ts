import { describe, expect, it } from "vitest";

import { MISS_PENALTY, moveValues, timeoutPenalty } from "@/lib/scoring/missPenalty";

/**
 * The miss penalty (rules §5.6): every move that scores no word costs a flat
 * −5; at 0:00 every move a player has not made costs −5 too.
 */
describe("missPenalty", () => {
  it("a miss costs a flat −5, however many came before", () => {
    expect(MISS_PENALTY).toBe(-5);
  });

  it("unplayed moves at 0:00 cost −5 each", () => {
    expect(timeoutPenalty(3)).toBe(-15);
    expect(timeoutPenalty(0)).toBe(0);
  });

  it("moveValues: a scoring move keeps its words, a miss is −5, unplayed moves are −5 only when penalised", () => {
    const scored = new Set([1, 4]);
    expect(moveValues({ movesPlayed: 5, scoredMoves: scored, moveLimit: 10, penalizeUnplayed: false })).toEqual([null, -5, -5, null, -5, undefined, undefined, undefined, undefined, undefined]);
    expect(moveValues({ movesPlayed: 5, scoredMoves: scored, moveLimit: 10, penalizeUnplayed: true })).toEqual([null, -5, -5, null, -5, -5, -5, -5, -5, -5]);
  });
});
