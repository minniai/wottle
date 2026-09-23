import { describe, expect, it } from "vitest";

import { lastMoves, latestResolved } from "@/lib/room/lastMoves";
import type { MoveResolution } from "@/lib/types/match";

/** Spec 068 FR-027, contracts/last-moves.md, eng review decision 1A. */
function move(over: Partial<MoveResolution> = {}): MoveResolution {
  return {
    matchId: "m1", moveId: "mv", playerId: "b", globalSeq: 9, seq: 6, status: "resolved",
    swap: { from: { x: 2, y: 3 }, to: { x: 3, y: 3 } }, board: [], words: [], delta: -5,
    totals: { playerA: 51, playerB: 24 }, frozenTiles: {}, movesPlayed: { playerA: 3, playerB: 6 }, resolvedAt: "",
    ...over,
  };
}

describe("lastMoves: the tick on each seat's last swap", () => {
  it("marks the two cells of each seat's latest resolved move", () => {
    expect(lastMoves({ you: move({ swap: { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } } }), opp: move() }, {})).toEqual({
      you: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      opp: [{ x: 2, y: 3 }, { x: 3, y: 3 }],
    });
  });

  it("drops a cell once its letter is frozen", () => {
    expect(lastMoves({ you: null, opp: move() }, { "2,3": { owner: "player_b" } }).opp).toEqual([{ x: 3, y: 3 }]);
  });

  it("no move yet, no tick", () => {
    expect(lastMoves({ you: null, opp: null }, {})).toEqual({ you: [], opp: [] });
  });

  it("a refused move changed no letter, so it never becomes the last move", () => {
    const before = move({ globalSeq: 9 });
    expect(latestResolved(before, move({ globalSeq: 11, status: "rejected", swap: { from: { x: 9, y: 9 }, to: { x: 8, y: 9 } } }))).toBe(before);
    expect(latestResolved(before, move({ globalSeq: 11 }))?.globalSeq).toBe(11);
    // An older resolution arriving late never replaces a newer one.
    expect(latestResolved(move({ globalSeq: 11 }), before)?.globalSeq).toBe(11);
  });

  it("after a reload onto a refused move there is no tick until that player moves again (decision 1A)", () => {
    expect(latestResolved(null, move({ status: "rejected" }))).toBeNull();
  });
});
