/** One match-long budget per player (rules §2a; spec 044 decision Q1). */
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
