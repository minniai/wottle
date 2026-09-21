import { describe, expect, it } from "vitest";

import { railCells, railLabel } from "@/lib/room/moveRail";

/** Spec 048 US3, spec 050: the rail counts the viewer's moves. */
describe("moveRail", () => {
  it("played cells are past, the next is current, the rest future", () => {
    const cells = railCells(3, false);
    expect(cells.map((c) => c.state)).toEqual(["past", "past", "past", "current", "future", "future", "future", "future", "future", "future"]);
    expect(cells[3].move).toBe(4);
  });
  it("all ten are past once the viewer has ten or the match is over", () => {
    expect(railCells(10, false).every((c) => c.state === "past")).toBe(true);
    expect(railCells(2, true).every((c) => c.state === "past")).toBe(true);
  });
  it("one accessible name", () => {
    expect(railLabel(3, false)).toBe("move 4 of 10");
    expect(railLabel(0, false)).toBe("move 1 of 10");
    expect(railLabel(10, false)).toBe("10 of 10 played");
    expect(railLabel(4, true)).toBe("10 of 10 played");
  });
});
