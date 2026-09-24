import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import { scrubberValueText, stepAtFraction } from "@/lib/review/scrubber";
import { timeoutPenalty } from "@/lib/scoring/missPenalty";

import { movesResponse, rowsFrom } from "./reviewFixtures";

const NAMES = { a: "Birna", b: "Kári" };

function steps() {
  const rows = rowsFrom([
    { slot: "player_a", at: 10, points: 33 },
    { slot: "player_b", at: 20 },
    { slot: "player_b", at: 25, refused: true },
  ]);
  rows[0].words = [
    { ...rows[0].words[0], word: "lek", totalPoints: 13 },
    { ...rows[0].words[0], word: "æsku", totalPoints: 20 },
  ];
  const tail = rows[rows.length - 1].scoreAfter;
  return buildReviewSteps(movesResponse(rows, "incomplete", { a: tail.a + timeoutPenalty(tail.a, 9), b: tail.b }));
}

describe("stepAtFraction", () => {
  it.each([
    [0, 1],
    [1, 20],
    [0.5, 11],
    [-1, 1],
    [2, 20],
  ])("puts %f of the bar at step %i of 20", (x, step) => {
    expect(stepAtFraction(x, 20)).toBe(step);
  });

  it("has one step for a one-step review", () => {
    expect(stepAtFraction(0.7, 1)).toBe(1);
  });
});

describe("scrubberValueText (spec 071 FR-033)", () => {
  const all = steps();
  it("says the step, the mover, the words and the points", () => {
    expect(scrubberValueText(all[0], all.length, NAMES, copyEn)).toBe("step 1 of 4, Birna, LEK ÆSKU plus 33");
    expect(scrubberValueText(all[0], all.length, NAMES, copyIs)).toBe("skref 1 af 4, Birna, LEK ÆSKU plús 33");
  });

  it("says a miss, a refusal and the closing step", () => {
    expect(scrubberValueText(all[1], all.length, NAMES, copyEn)).toBe("step 2 of 4, Kári, no word minus 0");
    expect(scrubberValueText(all[2], all.length, NAMES, copyEn)).toBe("step 3 of 4, Kári, refused");
    expect(scrubberValueText(all[3], all.length, NAMES, copyEn)).toBe("step 4 of 4, time, minus 33 not played");
  });
});
