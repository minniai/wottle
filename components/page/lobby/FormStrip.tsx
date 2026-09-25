"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { formStrip } from "@/lib/pages/formStrip";
import type { FormResult } from "@/lib/types/standing";

/** The form strip (game flow B1): ten ruled cells, oldest first; a win carries a bar in your colour, a loss one in theirs, a draw a muted one. Not a lane. */
export function FormStrip({ results }: { results: FormResult[] }) {
  const copy = useCopy();
  const strip = formStrip(results, copy);
  return (
    <div className="form-strip">
      <span className="page-caption form-strip__label">{copy.pages.LAST_TEN}</span>
      <div className="form-strip__cells" role="img" aria-label={strip.label}>
        {strip.cells.map((cell, i) => (
          <span key={i} className="form-strip__cell" data-result={cell.result ?? "none"} aria-hidden="true">
            {cell.letter}
          </span>
        ))}
      </div>
    </div>
  );
}
