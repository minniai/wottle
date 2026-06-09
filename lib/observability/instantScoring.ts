import { logPlaytestError, logPlaytestInfo } from "./log";

/**
 * Typed observability helpers for the instant-scoring fast path
 * (spec 042 / Linear O-57). Centralises event names and payload shapes so
 * post-ship analytics can answer "how often does the fast path fire?",
 * "how often does the race-window deferral happen?", and "what is the
 * failure rate?" without scraping arbitrary log strings.
 */

export interface InstantScoringFiredPayload {
  matchId: string;
  roundNumber: number;
  playerId: string;
  /** Number of scored words in the partial summary (≥1 when fired). */
  wordCount: number;
  /** Wall-clock duration of the fast path in milliseconds. */
  durationMs: number;
}

export interface InstantScoringDeferredPayload {
  matchId: string;
  roundNumber: number;
  /** Why the fast path skipped scoring (currently only race-window). */
  reason: "race-window";
}

export interface InstantScoringFailedPayload {
  matchId: string;
  roundNumber: number;
  /** May be undefined if the failure happened before we could read the submission. */
  playerId?: string;
  /** Short machine-readable reason ("timeout", "scoring-threw", "db-error", etc.). */
  reason: string;
}

export function trackInstantScoringFired(payload: InstantScoringFiredPayload): void {
  logPlaytestInfo("instant-scoring.fired", {
    matchId: payload.matchId,
    roundNumber: payload.roundNumber,
    playerId: payload.playerId,
    metadata: {
      wordCount: payload.wordCount,
      durationMs: payload.durationMs,
    },
  });
}

export function trackInstantScoringDeferred(payload: InstantScoringDeferredPayload): void {
  logPlaytestInfo("instant-scoring.deferred-to-combined", {
    matchId: payload.matchId,
    roundNumber: payload.roundNumber,
    metadata: { reason: payload.reason },
  });
}

export function trackInstantScoringFailed(payload: InstantScoringFailedPayload): void {
  logPlaytestError("instant-scoring.failed", {
    matchId: payload.matchId,
    roundNumber: payload.roundNumber,
    playerId: payload.playerId,
    metadata: { reason: payload.reason },
  });
}
