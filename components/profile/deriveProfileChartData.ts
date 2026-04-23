import type { RatingHistoryEntry } from "@/lib/types/match";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function windowStartMs(now: Date, days: number): number {
  return now.getTime() - days * MS_PER_DAY;
}

export function sliceRatingHistoryWindow(
  history: RatingHistoryEntry[],
  days: number,
  now: Date = new Date(),
): RatingHistoryEntry[] {
  const threshold = windowStartMs(now, days);
  return history.filter((e) => new Date(e.recordedAt).getTime() >= threshold);
}

export function deriveTodayRatingDelta(
  history: RatingHistoryEntry[],
  now: Date = new Date(),
): number {
  if (history.length === 0) return 0;
  const today = now.toISOString().slice(0, 10);
  const lastTodayIdx = findLastIndex(history, (e) => dayKey(e.recordedAt) === today);
  if (lastTodayIdx === -1) return 0;
  const lastBeforeIdx = findLastIndex(
    history,
    (e) => dayKey(e.recordedAt) < today,
  );
  if (lastBeforeIdx === -1) return 0;
  return history[lastTodayIdx].rating - history[lastBeforeIdx].rating;
}

export function deriveRecentRatingDelta(
  history: RatingHistoryEntry[],
  days: number,
  now: Date = new Date(),
): number {
  if (history.length === 0) return 0;
  const threshold = windowStartMs(now, days);
  const current = history[history.length - 1];
  const beforeIdx = findLastIndex(
    history,
    (e) => new Date(e.recordedAt).getTime() < threshold,
  );
  if (beforeIdx !== -1) {
    return current.rating - history[beforeIdx].rating;
  }
  const firstInWindow = history.find(
    (e) => new Date(e.recordedAt).getTime() >= threshold,
  );
  if (!firstInWindow || firstInWindow === current) return 0;
  return current.rating - firstInWindow.rating;
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}
