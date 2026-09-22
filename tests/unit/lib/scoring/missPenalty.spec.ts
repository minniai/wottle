import { describe, expect, it } from "vitest";

import { MISS_PENALTY, missPenaltyFor, moveValues, timeoutPenalty } from "@/lib/scoring/missPenalty";

/**
 * The miss penalty (rules §5.6, amended 2026-09-22): a move that scores no word
 * costs up to 5 points, never more than the player has, so a total never goes
 * below zero. At 0:00 every move a player has not made is a miss too.
 */
describe("missPenalty", () => {
  it("a miss costs at most 5", () => {
    expect(MISS_PENALTY).toBe(-5);
  });

  it("a miss costs the full 5 at 5 points or more", () => {
    expect(missPenaltyFor(5)).toBe(-5);
    expect(missPenaltyFor(120)).toBe(-5);
  });

  it("a miss costs only what is left below 5 points, and nothing at 0", () => {
    expect(missPenaltyFor(4)).toBe(-4);
    expect(missPenaltyFor(1)).toBe(-1);
    expect(Object.is(missPenaltyFor(0), 0)).toBe(true);
  });

  it("unplayed moves at 0:00 cost 5 each, but never take a total below 0", () => {
    expect(timeoutPenalty(40, 3)).toBe(-15);
    expect(timeoutPenalty(12, 3)).toBe(-12);
    expect(Object.is(timeoutPenalty(0, 3), 0)).toBe(true);
    expect(Object.is(timeoutPenalty(40, 0), 0)).toBe(true);
  });

  it("moveValues: a scoring move keeps its words, a miss costs up to 5 of the running total", () => {
    const movePoints = new Map([[1, 7], [4, 3]]);
    // 7 → 2 → 0 → 3 → 0: each miss takes what the total can give.
    expect(moveValues({ movesPlayed: 5, movePoints, moveLimit: 10, penalizeUnplayed: false })).toEqual([null, -5, -2, null, -3, undefined, undefined, undefined, undefined, undefined]);
  });

  it("moveValues: unplayed moves are penalised only when the match ended on the clock, and only down to 0", () => {
    const movePoints = new Map([[1, 30]]);
    expect(moveValues({ movesPlayed: 2, movePoints, moveLimit: 10, penalizeUnplayed: true })).toEqual([null, -5, -5, -5, -5, -5, -5, 0, 0, 0]);
  });

  it("moveValues: a miss at 0 points costs nothing", () => {
    expect(moveValues({ movesPlayed: 2, movePoints: new Map(), moveLimit: 3, penalizeUnplayed: false })).toEqual([0, 0, undefined]);
  });
});
