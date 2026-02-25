/**
 * Pure functions for server-authoritative clock computation.
 * All functions are deterministic via injectable `now` parameter.
 */

/**
 * Compute how many milliseconds remain for a player in the current round.
 * Elapsed time since round start is deducted from the stored timer value.
 */
export function computeRemainingMs(
  roundStartedAt: Date,
  storedRemainingMs: number,
  now: Date = new Date(),
): number {
  const elapsed = now.getTime() - roundStartedAt.getTime();
  return Math.max(0, storedRemainingMs - elapsed);
}

/**
 * Returns true when a player's clock has expired (no time remaining).
 */
export function isClockExpired(
  roundStartedAt: Date,
  storedRemainingMs: number,
  now: Date = new Date(),
): boolean {
  return computeRemainingMs(roundStartedAt, storedRemainingMs, now) <= 0;
}

/**
 * Compute how much time elapsed between round start and a player's submission.
 * Used to deduct the correct amount from the player's stored timer after resolution.
 */
export function computeElapsedMs(roundStartedAt: Date, submittedAt: Date): number {
  return submittedAt.getTime() - roundStartedAt.getTime();
}
