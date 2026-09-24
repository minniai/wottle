import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import { cellName, cursorRow, ledgerCellStates, stepOfCell } from "@/lib/review/ledgerCells";

import { bothFinished } from "./reviewFixtures";

describe("ledgerCellStates (spec 071 FR-036)", () => {
  const steps = buildReviewSteps(bothFinished());

  it("marks moves reached, the current one, and those ahead", () => {
    const states = ledgerCellStates(steps, 7);
    expect(states.get("player_a:3")).toBe("current");
    expect(states.get("player_a:1")).toBe("reached");
    expect(states.get("player_b:4")).toBe("reached");
    expect(states.get("player_b:5")).toBe("ahead");
    expect(states.get("player_a:10")).toBe("ahead");
  });

  it("finds the step a cell jumps to", () => {
    expect(stepOfCell(steps, "player_b", 4)).toBe(6);
    expect(stepOfCell(steps, "player_a", 11)).toBeNull();
  });

  it("names a cell not yet reached", () => {
    expect(cellName("player_b", 8, { a: "Birna", b: "Kári" }, "ahead", copyEn)).toBe("move 8, Kári, not yet reached");
    expect(cellName("player_b", 8, { a: "Birna", b: "Kári" }, "ahead", copyIs)).toBe("leikur 8, Kári, ekki komið að");
    expect(cellName("player_a", 2, { a: "Birna", b: "Kári" }, "reached", copyEn)).toBe("move 2, Birna");
  });

  it("puts the cursor line on the step's move, or the closing step on the first unplayed row", () => {
    expect(cursorRow(steps[6], 10)).toEqual({ slot: "player_a", move: 3 });
    const closing = { ...steps[19], kind: "closing" as const, slot: null, moveNumber: null, movesPlayed: { a: 8, b: 9 } };
    expect(cursorRow(closing, 10)).toEqual({ slot: null, move: 9 });
    expect(cursorRow({ ...closing, movesPlayed: { a: 10, b: 10 } }, 10)).toBeNull();
  });
});

