/**
 * Spec 071 (FR-040): `?review=n`. Null without the parameter; `last`, empty or not a number is
 * the last step; a number is clamped to the steps there are. `canonical` is written back.
 */
export function parseReviewParam(raw: string | null, stepCount: number): { step: number; canonical: string } | null {
  if (raw === null) return null;
  const last = Math.max(1, stepCount);
  const n = Number.parseInt(raw, 10);
  const step = Number.isNaN(n) ? last : Math.min(Math.max(n, 1), last);
  return { step, canonical: String(step) };
}
