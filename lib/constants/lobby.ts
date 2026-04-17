/**
 * Lobby-wide constants for spec 019 lobby-visual-foundation.
 * Drives layout thresholds, polling cadence, and motion timing.
 */

/** Maximum visible player cards in the directory (FR-009a). */
export const LOBBY_DIRECTORY_CAP = 24;

/** Poll cadence for GET /api/lobby/stats/matches-in-progress (FR-008b). */
export const LOBBY_STATS_POLL_MS = 10_000;

/** Interval between hero word transitions (FR-001a). */
export const HERO_WORD_CYCLE_MS = 5_000;

/** Per-letter flip duration during hero word transition. */
export const HERO_WORD_FLIP_MS = 350;

/** Stagger between consecutive letter flips. */
export const HERO_WORD_STAGGER_MS = 40;

/** Default auto-dismiss for toast notifications. */
export const TOAST_DEFAULT_DISMISS_MS = 4_000;
