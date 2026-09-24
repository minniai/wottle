import type { Language } from "@/lib/types/game-config";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { FormResult } from "@/lib/types/standing";

/**
 * Spec 072: what a profile page shows (E1, E2, F9). It replaces the old
 * `PlayerProfile` on pages and never carries a last-seen time, a status or an
 * avatar: `tests/unit/types/profile-view-allowlist.test.ts` pins its keys.
 */
export type PresenceWordState = "here" | "in_match" | "away" | "other_lobby" | "not_here";

export interface PresenceWord {
  state: PresenceWordState;
  movesPlayed: number | null;
}

export interface ProfileWord {
  word: string;
  points: number;
  tiles: { letter: string; value: number }[];
}

export interface ProfileRecord {
  won: number;
  lost: number;
  drawn: number;
  /** won ÷ matches, 0–1; null with no matches (FR-032). */
  winRate: number | null;
}

/** One rated match in this language, oldest first: what the chart, the week and the peak are read from. */
export interface RatingEvent {
  at: string;
  before: number;
  after: number;
}

export interface ChartPoint {
  at: string;
  rating: number;
}

export interface ProfileView {
  playerId: string;
  handle: string;
  displayName: string;
  language: Language;
  rating: number;
  peak: number;
  /** The change over the last 7 days; 0 hides the clause. */
  weekChange: number;
  /** Rated matches played in this language. */
  matches: number;
  /** The first rated match in this language; null for a new player. */
  firstPlayedAt: string | null;
  record: ProfileRecord;
  /** Oldest first. */
  lastTen: FormResult[];
  /** The 30-day series; the first point is the rating at the window's start. */
  chart: ChartPoint[];
  /** No match in the window: the chart is a flat line at the rating. */
  chartEmpty: boolean;
  bestWords: ProfileWord[];
  otherLanguage: { language: Language; rating: number; matches: number };
  /** Own: the recent eight. Public: the viewer's matches against this player. */
  matchesList: RecentGameRow[];
  /** Public profiles only. */
  presence: PresenceWord | null;
}
