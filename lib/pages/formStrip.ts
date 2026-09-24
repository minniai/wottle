import type { Copy } from "@/lib/i18n/copy/types";
import type { FormResult } from "@/lib/types/standing";

const CELLS = 10;

export interface FormCell {
  letter: string;
  result: FormResult | null;
}

/** The form strip (spec 070 US2.1, game flow B1): ten ruled cells, oldest first; the letter carries the meaning. */
export function formStrip(results: FormResult[], copy: Copy): { cells: FormCell[]; label: string } {
  const last = results.slice(-CELLS);
  const cells: FormCell[] = Array.from({ length: CELLS }, (_, i) => {
    const result = last[i] ?? null;
    return { letter: result ? copy.pages.FORM_LETTERS[result] : "", result };
  });
  const count = (r: FormResult) => last.filter((x) => x === r).length;
  return { cells, label: copy.pages.formAria(count("W"), count("L"), count("D")) };
}
