import "server-only";

/**
 * In-memory disconnect tracker, shared between `handlePlayerDisconnect`
 * (Server Action) and `claimWinAction` (Server Action).
 *
 * Lives outside any `"use server"` file so we can export synchronous
 * helpers like `getDisconnectedAt` and the `RECONNECT_WINDOW_MS` constant —
 * Next.js requires every export of a `"use server"` module to be an async
 * Server Action, which this file deliberately is not.
 *
 * Scope note: the store is per-process. In a multi-instance production
 * deployment this should graduate to Redis or a database row; for the
 * current playtest scale a single serverless instance is fine.
 */

/** How long (in ms) an opponent may be disconnected before `claimWin` is allowed. */
export const RECONNECT_WINDOW_MS = 90_000;

interface DisconnectRecord {
  matchId: string;
  playerId: string;
  disconnectedAt: string;
}

const disconnectStore = new Map<string, DisconnectRecord>();

function keyFor(matchId: string, playerId: string): string {
  return `${matchId}:${playerId}`;
}

/** Record a fresh disconnect. Overwrites any prior entry for the same player+match. */
export function recordDisconnect(matchId: string, playerId: string): void {
  disconnectStore.set(keyFor(matchId, playerId), {
    matchId,
    playerId,
    disconnectedAt: new Date().toISOString(),
  });
}

/**
 * Returns the current disconnect record if one exists, else `null`.
 * Kept as a separate helper from {@link getDisconnectedAt} because
 * `handlePlayerReconnect` needs to know if there IS a record (to decide
 * whether to clear it + broadcast), not just the timestamp.
 */
export function getDisconnectRecord(
  matchId: string,
  playerId: string,
): { matchId: string; playerId: string; disconnectedAt: string } | null {
  return disconnectStore.get(keyFor(matchId, playerId)) ?? null;
}

/**
 * Returns the timestamp (ms since epoch) when the player first lost their
 * connection for this match, or `null` if they are currently connected.
 * Used by `claimWinAction` to check whether the 90s window has elapsed.
 */
export function getDisconnectedAt(
  matchId: string,
  playerId: string,
): number | null {
  const record = disconnectStore.get(keyFor(matchId, playerId));
  if (!record) return null;
  return new Date(record.disconnectedAt).getTime();
}

/** Clear the record. Returns true if a record existed, false otherwise. */
export function clearDisconnect(matchId: string, playerId: string): boolean {
  return disconnectStore.delete(keyFor(matchId, playerId));
}

/** @internal — test hook. Leaks nothing in prod since this is server-only. */
export function __resetDisconnectStoreForTests(): void {
  disconnectStore.clear();
}
