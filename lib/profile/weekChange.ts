import type { RatingEvent } from "@/lib/types/profile";

const WEEK_MS = 7 * 86_400_000;

/**
 * The rating's change over the last seven days (spec 072 FR-030): today's
 * rating less the rating held a week ago, which is the last `after` before the
 * week, or the first `before` inside it.
 */
export function weekChange(events: RatingEvent[], current: number, now: Date): number {
  const since = now.getTime() - WEEK_MS;
  const before = events.filter((e) => Date.parse(e.at) <= since).at(-1);
  const within = events.find((e) => Date.parse(e.at) > since);
  const then = before?.after ?? within?.before ?? current;
  return current - then;
}
