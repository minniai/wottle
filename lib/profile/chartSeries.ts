import type { ChartPoint, RatingEvent } from "@/lib/types/profile";

const DAY_MS = 86_400_000;

/**
 * The 30-day chart's points (spec 072 FR-031): the rating held when the window
 * opens, one point per match inside it, and today. With no match inside, a
 * flat line at the current rating (`empty`).
 */
export function chartSeries(events: RatingEvent[], current: number, now: Date, days = 30): { points: ChartPoint[]; empty: boolean } {
  const start = new Date(now.getTime() - days * DAY_MS).toISOString();
  const inside = events.filter((e) => e.at > start);
  const today = now.toISOString();
  if (inside.length === 0) return { empty: true, points: [{ at: start, rating: current }, { at: today, rating: current }] };
  const opening = events.filter((e) => e.at <= start).at(-1)?.after ?? inside[0].before;
  return { empty: false, points: [{ at: start, rating: opening }, ...inside.map((e) => ({ at: e.at, rating: e.after })), { at: today, rating: current }] };
}
