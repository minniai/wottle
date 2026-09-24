import { describe, expect, it } from "vitest";

import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import { wordsAtStep } from "@/lib/review/wordsAtStep";

import { A, B, bothFinished } from "./reviewFixtures";

describe("wordsAtStep (spec 071 FR-032)", () => {
  const steps = buildReviewSteps(bothFinished());

  it("keeps the words scored up to the step, and names the step's own move as the live one", () => {
    const { words, liveMoveKey } = wordsAtStep(steps, 5, A);
    expect(words.map((w) => w.globalSeq)).toEqual([1, 2, 3, 5]);
    expect(liveMoveKey).toBe(`${B}:3`);
    expect(words.every((w) => w.moveSeq > 0)).toBe(true);
  });

  it("has no live move for a step without words", () => {
    expect(wordsAtStep(steps, 4, A).liveMoveKey).toBeNull();
  });
});
