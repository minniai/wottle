import { describe, expect, it } from "vitest";

import { railCells, railLabel } from "@/lib/room/roundRail";

describe("railCells (spec 048 US3)", () => {
  it("round 4: three past, one current, six future", () => {
    const cells = railCells(4, false);
    expect(cells).toHaveLength(10);
    expect(cells.filter((c) => c.state === "past").map((c) => c.round)).toEqual([1, 2, 3]);
    expect(cells[3]).toEqual({ round: 4, state: "current" });
    expect(cells.slice(4).every((c) => c.state === "future")).toBe(true);
  });
  it("a completed match fills all ten", () => {
    expect(railCells(10, true).every((c) => c.state === "past")).toBe(true);
  });
  it("before round 1 every cell is future", () => {
    expect(railCells(0, false).every((c) => c.state === "future")).toBe(true);
  });
  it("labels the rail once", () => {
    expect(railLabel(4, false)).toBe("round 4 of 10");
    expect(railLabel(10, true)).toBe("10 of 10 rounds played");
    expect(railLabel(0, false)).toBe("round 1 of 10");
  });
});
