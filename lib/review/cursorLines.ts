import type { Copy } from "@/lib/i18n/copy/types";
import type { ReviewStep } from "@/lib/types/review";

import { closingPoints, closingWord, moverName, signed, wordsOf, type ReviewNames } from "./stepFacts";

/**
 * Spec 071 (FR-037): the cursor line, in the live row's place. Line 1 is what the step did,
 * line 2 what it froze and who leads, or why it was refused.
 */
export function cursorLines(step: ReviewStep, names: ReviewNames, copy: Copy): { line1: string; line2: string } {
  return { line1: firstLine(step, names, copy), line2: secondLine(step, names, copy) };
}

function firstLine(step: ReviewStep, names: ReviewNames, copy: Copy): string {
  const { review } = copy;
  if (step.kind === "closing") return `${closingWord(step, copy)} · ${review.notPlayed(signed(closingPoints(step)))}`;
  const head = review.move(step.moveNumber ?? 0, moverName(step, names));
  if (step.kind === "refused") return `${head} · ${review.REFUSED}`;
  if (!step.words.length) return `${head} · ${review.NO_WORD} ${signed(step.points)}`;
  return `${head} · ${wordsOf(step, " · ")} ${signed(step.points)}`;
}

function secondLine(step: ReviewStep, names: ReviewNames, copy: Copy): string {
  if (step.kind === "refused") return copy.review.refusedWhy(step.refusal ?? "frozen");
  const lead = leadLine(step, names, copy);
  return step.frozeCount > 0 ? `${copy.review.froze(step.frozeCount)} · ${lead}` : lead;
}

function leadLine(step: ReviewStep, names: ReviewNames, copy: Copy): string {
  const { a, b } = step.totals;
  if (a === b) return copy.review.level(a, b);
  return a > b ? copy.review.leads(names.a, a, b) : copy.review.leads(names.b, b, a);
}
