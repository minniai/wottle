"use client";

import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import { MATCH_CLOCK_BUDGET_MS, formatClock } from "@/lib/room/clock";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";

/**
 * The line slot when nothing stands (game flow §5.0): the place on the left,
 * the terms on the right, built from the configuration. The lobby itself
 * leaves the counts out, since it lists them.
 */
export function SlotTerms({ counts }: { counts: { here: number; playing: number } | null }) {
  const copy = useCopy();
  const locale = useLocale();
  const languageName = locale.id === "is" ? copy.pages.LANGUAGE_NAME_IS : copy.pages.LANGUAGE_NAME_EN;
  return (
    <div className="slot-terms" data-testid="slot-empty">
      <span className="page-label">{copy.pages.slotPlace(languageName, counts?.here ?? null, counts?.playing ?? null)}</span>
      <span className="page-label">{copy.pages.terms(TOTAL_MOVES, formatClock(MATCH_CLOCK_BUDGET_MS))}</span>
    </div>
  );
}
