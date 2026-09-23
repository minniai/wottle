/** The one match clock, shared by both players (rules §2a; spec 050). */
export const MATCH_CLOCK_BUDGET_MS = 300_000;

/** Under one minute the scoreboard's clock row takes the tint and a heavier numeral (spec 068). */
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

/** The scoreboard's clock (spec 068): ten 30s blocks, each of six 5s ticks. */
export const TICK_MS = 5_000;
export const TICKS_PER_BLOCK = 6;
export const BLOCK_MS = TICK_MS * TICKS_PER_BLOCK;
const BLOCKS = 10;
/** In the last 15 seconds the label counts them down in ink; nothing blinks (spec 068 FR-006). */
export const LAST_SECONDS_MS = 15_000;

/** The clock row's look: weight only, never a flash (spec 068). */
export type ClockRowPhase = "running" | "underMinute" | "lastSeconds" | "time";

export function ticksLeft(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / TICK_MS));
}

/** Ticks in each 30s block, left to right; the clock empties from the right. */
export function clockBlocks(ticks: number): number[] {
  return Array.from({ length: BLOCKS }, (_, k) => Math.min(TICKS_PER_BLOCK, Math.max(0, ticks - TICKS_PER_BLOCK * k)));
}

export function clockRowPhase(remainingMs: number): ClockRowPhase {
  if (remainingMs <= 0) return "time";
  if (remainingMs <= LAST_SECONDS_MS) return "lastSeconds";
  return isLowClock(remainingMs) ? "underMinute" : "running";
}

/** Whole seconds per move left (`≈27s a move`), or null when no move is left. */
export function pace(remainingMs: number, movesLeft: number): number | null {
  if (movesLeft <= 0) return null;
  return Math.round(Math.max(0, remainingMs) / 1000 / movesLeft);
}

/** Short of a full block per move left: the clock's blocks and the moves compare down a column (spec 068 FR-007). */
export function behindPace(movesLeft: number, remainingMs: number): boolean {
  if (movesLeft <= 0) return false;
  const blocksLeft = Math.floor(Math.max(0, remainingMs) / 1000) / (BLOCK_MS / 1000);
  return movesLeft - blocksLeft >= 1;
}

/** The device clock shifted by the drift the last snapshot measured, so server timestamps compare fairly. */
export function serverCorrectedNow(serverNow: string, localNowAtSnapshot: number, now: number): number {
  return now + (new Date(serverNow).getTime() - localNowAtSnapshot);
}

/** Mirrors lib/match/disconnectStore RECONNECT_WINDOW_MS for client rendering (that module is server-only). */
export const RECONNECT_WINDOW_MS_CLIENT = 90_000;
