/** The one match clock, shared by both players (rules §2a; spec 050). */
export const MATCH_CLOCK_BUDGET_MS = 300_000;

/** Under one minute the lane thickens and blinks (design system §5.3). */
export const LOW_CLOCK_MS = 60_000;

export function isLowClock(remainingMs: number): boolean {
  return remainingMs < LOW_CLOCK_MS;
}

export function formatClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function laneFraction(remainingMs: number, budgetMs = MATCH_CLOCK_BUDGET_MS): number {
  return Math.min(1, Math.max(0, remainingMs / budgetMs));
}

/**
 * Time left on the shared clock (spec 050): the deadline against a local clock
 * corrected by the server's `serverNow` at snapshot time. Full budget before
 * the match starts, 0 after the deadline.
 */
export function remainingFromDeadline(clock: { deadlineAt: string | null; serverNow: string }, localNowAtSnapshot: number, now: number, budgetMs = MATCH_CLOCK_BUDGET_MS): number {
  if (!clock.deadlineAt) return budgetMs;
  const drift = new Date(clock.serverNow).getTime() - localNowAtSnapshot;
  return Math.max(0, new Date(clock.deadlineAt).getTime() - (now + drift));
}

/** Mirrors lib/match/disconnectStore RECONNECT_WINDOW_MS for client rendering (that module is server-only). */
export const RECONNECT_WINDOW_MS_CLIENT = 90_000;
