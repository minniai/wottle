import { describe, expect, it } from "vitest";

import { segmentStates } from "@/lib/room/segments";

describe("segmentStates (a player's ten moves on the track, spec 050 / 068)", () => {
  it("lists the moves left first and the spent ones after", () => {
    expect(segmentStates(3, 10, false)).toEqual([...Array(7).fill("left"), ...Array(3).fill("spent")]);
  });

  it("shows the move in flight as scoring: the rightmost move still left", () => {
    const states = segmentStates(3, 10, true);
    expect(states[6]).toBe("scoring");
    expect(states.filter((s) => s === "left")).toHaveLength(6);
  });

  it("is all spent at ten and all left at none", () => {
    expect(segmentStates(10, 10, false)).toEqual(Array(10).fill("spent"));
    expect(segmentStates(0, 10, false)).toEqual(Array(10).fill("left"));
  });

  it("never goes below zero moves left", () => {
    expect(segmentStates(12, 10, true)).toEqual(Array(10).fill("spent"));
  });
});
