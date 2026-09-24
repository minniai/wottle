import type { MatchEndedReason } from "@/lib/types/match";

const PENALISING: ReadonlySet<MatchEndedReason> = new Set(["incomplete", "both_incomplete", "ended_early"]);

/** The settlement charged each unplayed move as a miss (rules §5.6): at 0:00, and at an early end (spec 071). */
export function penalisesUnplayed(reason: MatchEndedReason | null | undefined): boolean {
  return reason != null && PENALISING.has(reason);
}
