/**
 * Rematch timings (spec 071, GAME_FLOW_SPEC §7.8 and §10 Q10). The database decides every one of
 * them (`request_rematch`, `accept_rematch`, `expire_due_rematches`); the client reads them only to
 * draw the drain.
 */

/** A request lasts 30s. */
export const REMATCH_REQUEST_MS = 30_000;

/** A request may be sent only within 2:00 of the match's completion. */
export const REMATCH_WINDOW_MS = 120_000;

/** `match:rematch`: request, answer and withdraw share one per-player limit. */
export const REMATCH_RATE_LIMIT = { scope: "match:rematch", limit: 6, windowMs: 60_000 } as const;
