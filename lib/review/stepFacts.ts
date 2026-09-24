import type { Copy } from "@/lib/i18n/copy/types";
import type { ReviewStep } from "@/lib/types/review";

export interface ReviewNames {
  a: string;
  b: string;
}

export function moverName(step: ReviewStep, names: ReviewNames): string {
  return step.slot === "player_a" ? names.a : names.b;
}

/** The step's words as the field spells them: `LEK · ÆSKU`. */
export function wordsOf(step: ReviewStep, separator: string): string {
  return step.words.map((w) => w.word.toLocaleUpperCase("is")).join(separator);
}

/** A total's change as drawn: `+33`, `−5`. */
export function signed(points: number): string {
  return points < 0 ? `−${Math.abs(points)}` : `+${points}`;
}

/** What the closing step cost both players together (a negative number or 0). */
export function closingPoints(step: ReviewStep): number {
  return step.closing ? step.closing.penalty.a + step.closing.penalty.b : 0;
}

export function closingWord(step: ReviewStep, copy: Copy): string {
  return step.closing?.reason === "ended_early" ? copy.review.ENDED_EARLY : copy.review.TIME;
}
