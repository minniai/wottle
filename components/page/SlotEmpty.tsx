/**
 * The line slot when nothing stands (game flow §5.0, amended 2026-09-25): empty.
 * The place and the counts repeated what the page says below, and the terms are
 * said where they decide something. The height stays reserved, so nothing below
 * moves when a call or a search arrives (spec 070 SC-006).
 */
export function SlotEmpty() {
  return <div className="slot-empty" data-testid="slot-empty" aria-hidden="true" />;
}
