/**
 * The table (spec 069): every match begins with both players sitting down.
 * The timings are owner decisions (game flow spec §10 Q10); the constants
 * the database also enforces are repeated in `20260924001_the_table.sql`.
 */

/** FR-002: an unseated player has 20s from the match's creation to sit down. */
export const TABLE_SEAT_WINDOW_MS = 20_000;
/** FR-004: the completing seat sets the start this far ahead (C2). */
export const TABLE_LEAD_MS = 4_500;
/** FR-010: the ready slip lifts this long before go, while `3` shows. */
export const SLIP_LIFT_BEFORE_GO_MS = 3_300;
/** FR-002: input within this window, in a visible tab, seats a player at creation. */
export const ATTENTION_INPUT_WINDOW_MS = 30_000;
/** R5: an attention report older than this says nothing. */
export const ATTENTION_FRESH_MS = 10_000;
/** FR-020: only searchers heard from within this window are paired. */
export const QUEUE_FRESH_MS = 10_000;
/** FR-022: the "still searching?" check. */
export const QUEUE_CHECK_AT_MS = 180_000;
/** FR-022: the check's drain; unanswered, the search stops. */
export const QUEUE_CHECK_DRAIN_MS = 30_000;
/** FR-024: two table leaves within this window start the cooldown. */
export const TABLE_LEAVE_WINDOW_MS = 600_000;
/** FR-024: how long searching and sending challenges are refused. */
export const TABLE_LEAVE_COOLDOWN_MS = 300_000;
/** FR-025a: how often a room page checks for a table waiting for the player. */
export const TABLE_CHECK_POLL_MS = 3_000;
