import type { Copy } from "@/lib/i18n/copy/types";
import type { ReviewStep } from "@/lib/types/review";

import { closingPoints, closingWord, moverName, wordsOf, type ReviewNames } from "./stepFacts";

/** Spec 071 (FR-033): a point along the scrubber, 0–1, is a step, 1–n. */
export function stepAtFraction(x: number, stepCount: number): number {
  if (stepCount <= 1) return 1;
  const clamped = Math.min(Math.max(x, 0), 1);
  return Math.round(clamped * (stepCount - 1)) + 1;
}

/** The slider's value text: `step 7 of 20, Birna, LEK ÆSKU plus 33`. */
export function scrubberValueText(step: ReviewStep, stepCount: number, names: ReviewNames, copy: Copy): string {
  const { review } = copy;
  if (step.kind === "closing") {
    return review.valueText(step.index, stepCount, closingWord(step, copy), review.notPlayed(review.minus(Math.abs(closingPoints(step)))));
  }
  const who = moverName(step, names);
  if (step.kind === "refused") return review.valueText(step.index, stepCount, who, review.REFUSED);
  const what = step.words.length ? `${wordsOf(step, " ")} ${review.plus(step.points)}` : `${review.NO_WORD} ${review.minus(Math.abs(step.points))}`;
  return review.valueText(step.index, stepCount, who, what);
}
