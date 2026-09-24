import { describe, expect, it } from "vitest";

import { penalisesUnplayed } from "@/lib/match/endedReasons";

describe("penalisesUnplayed", () => {
  it("is true when the settlement charged unplayed moves: 0:00, or an early end", () => {
    expect(penalisesUnplayed("incomplete")).toBe(true);
    expect(penalisesUnplayed("both_incomplete")).toBe(true);
    expect(penalisesUnplayed("ended_early")).toBe(true);
  });

  it("is false for every other ending", () => {
    for (const reason of ["moves_complete", "forfeit", "abandoned", "void", "error", "disconnect", null, undefined] as const) {
      expect(penalisesUnplayed(reason)).toBe(false);
    }
  });
});
