"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";

interface PointsLostProps {
  /** The points lost: negative, or 0 when a floored miss cost nothing. */
  value: number;
  /** What was lost, in words: `no word`, `not played`, `if unplayed`. */
  label: string;
  /** `no word −5` (your column, reading inward to the spine) rather than `−5 not played`. */
  labelFirst?: boolean;
}

/**
 * The one place `--err` is drawn (spec 068 FR-021, FR-022): the number of
 * points lost in crimson beside its label in muted, so colour is never the
 * only carrier. Nothing lost is not a loss, so a floored 0 stays muted.
 */
export function PointsLost({ value, label, labelFirst = false }: PointsLostProps) {
  const { points } = useCopy();
  const number = <span className={value < 0 ? "ledger__total points-lost" : "ledger__total points-none"}>{points(value)}</span>;
  const words = <span className="ledger__miss">{label}</span>;
  return labelFirst ? (
    <>
      {words}
      {number}
    </>
  ) : (
    <>
      {number}
      {words}
    </>
  );
}
