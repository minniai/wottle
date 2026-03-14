/**
 * Contract: RoundMove — Extended Type
 *
 * This file documents the breaking type change to RoundMove introduced in
 * spec 015-sensory-feedback. The `submittedAt` field is required to support
 * server-authoritative sequential reveal ordering in MatchClient.
 *
 * Upstream producer: lib/scoring/roundSummary.ts (aggregateRoundSummary)
 * Downstream consumers:
 *   - components/match/MatchClient.tsx (sequential reveal phase machine)
 *
 * Source column: move_submissions.created_at (TIMESTAMPTZ, mapped to ISO string)
 */

import type { Coordinate } from "@/lib/types/board";

export interface RoundMove {
  /** ID of the player who made this move. */
  playerId: string;

  /** Source tile coordinate before the swap. */
  from: Coordinate;

  /** Destination tile coordinate after the swap. */
  to: Coordinate;

  /**
   * ISO 8601 timestamp of when the move_submission record was created.
   * Used to sort moves into submission order for the sequential round reveal.
   * Server-authoritative: sourced from move_submissions.created_at.
   */
  submittedAt: string;
}

/**
 * Contract: SensoryPreferences
 *
 * Stored in localStorage under key "wottle-sensory-prefs".
 * No server persistence. Defaults to both enabled on first visit.
 */
export interface SensoryPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export const SENSORY_PREFERENCES_DEFAULT: SensoryPreferences = {
  soundEnabled: true,
  hapticsEnabled: true,
};

export const SENSORY_PREFS_STORAGE_KEY = "wottle-sensory-prefs" as const;
