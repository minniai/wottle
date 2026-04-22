import "server-only";

/**
 * In-memory heartbeat tracker used to detect player disconnections without
 * relying on the disconnecting client cooperatively notifying the server.
 *
 * MatchClient polls `/api/match/[matchId]/state` every few seconds; that
 * endpoint records the caller's heartbeat here. `loadMatchState` then
 * consults the heartbeat for the *other* player — if it's older than
 * `STALE_THRESHOLD_MS`, the other player is considered disconnected and the
 * snapshot's `disconnectedPlayerId` is set accordingly.
 *
 * This works even when the disconnecting browser is force-killed (Playwright
 * `context.close`, browser crash, network drop), because no notification from
 * the dying side is required — the surviving side detects staleness on its
 * next poll.
 *
 * Scope note: per-process Map. In a multi-instance deployment this should
 * graduate to Redis or a dedicated table.
 */

/** Polling cadence is ~3s; allow up to ~3 missed polls before flagging. */
export const HEARTBEAT_STALE_THRESHOLD_MS = 10_000;

const heartbeats = new Map<string, number>();

function keyFor(matchId: string, playerId: string): string {
  return `${matchId}:${playerId}`;
}

export function recordHeartbeat(matchId: string, playerId: string): void {
  heartbeats.set(keyFor(matchId, playerId), Date.now());
}

export function getLastHeartbeat(
  matchId: string,
  playerId: string,
): number | null {
  return heartbeats.get(keyFor(matchId, playerId)) ?? null;
}

export function isHeartbeatStale(
  matchId: string,
  playerId: string,
  now: number = Date.now(),
): boolean {
  const lastSeen = heartbeats.get(keyFor(matchId, playerId));
  if (lastSeen === undefined) {
    // Never seen — not stale; the player simply hasn't polled yet.
    return false;
  }
  return now - lastSeen > HEARTBEAT_STALE_THRESHOLD_MS;
}

export function clearHeartbeat(matchId: string, playerId: string): void {
  heartbeats.delete(keyFor(matchId, playerId));
}

/** @internal — test hook. */
export function __resetHeartbeatStoreForTests(): void {
  heartbeats.clear();
}
