/**
 * Presence and challenge timings (spec 070 FR-032, game flow spec §7.1). One
 * module for the client and the server; the database repeats the ones it
 * enforces in `20260925001_door_lobby.sql`. The timings are owner decisions
 * (§10 Q10) and are not tuned here.
 */

/** A visible tab reports every 10s. */
export const HEARTBEAT_VISIBLE_MS = 10_000;
/** A hidden tab reports every 30s. */
export const HEARTBEAT_HIDDEN_MS = 30_000;
/** Three missed beats, plus 5s of slack for a slow request. */
const MISSED_BEATS = 3;
const GONE_SLACK_MS = 5_000;
/** A tab is gone once it has missed three beats of its last cadence (35s visible, 95s hidden). */
export function goneAfterMs(cadenceMs: number): number {
  return MISSED_BEATS * cadenceMs + GONE_SLACK_MS;
}
/** Every tab hidden this long: the player is away and cannot be challenged. */
export const AWAY_AFTER_MS = 120_000;
/** A tab that sent its leaving beacon is gone unless it beats again within this. */
export const LEAVING_GRACE_MS = 8_000;
/** Lobbies read again this long after a leaving poke, just past the grace. */
export const LEAVING_RECHECK_MS = 8_500;
/** Input within this window, in a visible tab, is attention (spec 069 seating). */
export const RECENT_INPUT_MS = 30_000;

/** A challenge lasts 60s. */
export const CHALLENGE_TTL_MS = 60_000;
/** After a decline, the same sender may not challenge the same player for 60s. */
export const DECLINE_COOLDOWN_MS = 60_000;
/** A sender may send at most six challenges a minute. */
export const CHALLENGE_LIMIT_PER_MINUTE = 6;
/** Three declines from one player within 10 minutes silence that sender's challenges to them… */
export const SILENCE_AFTER_DECLINES = 3;
export const SILENCE_WINDOW_MS = 600_000;
/** …for the session: the session cookie's 4 hours (research R7). */
export const SILENCE_FOR_MS = 4 * 3_600_000;

/** An outcome stays on the row and in the slot for 4s. */
export const OUTCOME_HOLD_MS = 4_000;
/** `accepted` shows for 400ms, then the table opens. */
export const ACCEPTED_HOLD_MS = 400;
/** A control that appears or changes meaning ignores activation this long. */
export const ACTIVATION_GUARD_MS = 500;

/** Standing and lobby reads without the player channel. */
export const POLL_FALLBACK_MS = 3_000;
/** Standing and lobby reads while the player channel is joined. */
export const POLL_LIVE_MS = 12_000;
