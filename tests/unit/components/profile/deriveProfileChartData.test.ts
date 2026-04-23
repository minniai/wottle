import { describe, expect, it } from "vitest";

import {
  deriveRecentRatingDelta,
  deriveTodayRatingDelta,
  sliceRatingHistoryWindow,
} from "@/components/profile/deriveProfileChartData";
import type { RatingHistoryEntry } from "@/lib/types/match";

const NOW = new Date("2026-04-23T15:30:00Z");

function entry(recordedAt: string, rating: number): RatingHistoryEntry {
  return { recordedAt, rating };
}

describe("sliceRatingHistoryWindow", () => {
  it("returns empty array when history is empty", () => {
    expect(sliceRatingHistoryWindow([], 30, NOW)).toEqual([]);
  });

  it("keeps entries within the window", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-20T10:00:00Z", 1700),
      entry("2026-04-22T12:00:00Z", 1710),
      entry("2026-04-23T09:00:00Z", 1720),
    ];
    expect(sliceRatingHistoryWindow(history, 30, NOW)).toHaveLength(3);
  });

  it("filters out entries older than the window", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-03-01T10:00:00Z", 1600),
      entry("2026-04-22T12:00:00Z", 1710),
      entry("2026-04-23T09:00:00Z", 1720),
    ];
    expect(sliceRatingHistoryWindow(history, 30, NOW)).toHaveLength(2);
  });

  it("handles a 7-day window", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-10T10:00:00Z", 1600),
      entry("2026-04-18T12:00:00Z", 1700),
      entry("2026-04-23T09:00:00Z", 1720),
    ];
    expect(sliceRatingHistoryWindow(history, 7, NOW)).toHaveLength(2);
  });
});

describe("deriveTodayRatingDelta", () => {
  it("returns 0 for empty history", () => {
    expect(deriveTodayRatingDelta([], NOW)).toBe(0);
  });

  it("returns 0 when no entries fall on today", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-21T12:00:00Z", 1700),
      entry("2026-04-22T12:00:00Z", 1710),
    ];
    expect(deriveTodayRatingDelta(history, NOW)).toBe(0);
  });

  it("returns last-today minus last-before-today", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-22T12:00:00Z", 1700),
      entry("2026-04-23T09:00:00Z", 1712),
      entry("2026-04-23T14:00:00Z", 1724),
    ];
    expect(deriveTodayRatingDelta(history, NOW)).toBe(24);
  });

  it("returns a negative delta when rating dropped today", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-22T12:00:00Z", 1720),
      entry("2026-04-23T09:00:00Z", 1700),
    ];
    expect(deriveTodayRatingDelta(history, NOW)).toBe(-20);
  });

  it("returns 0 when today's entry is the first ever rating", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-23T09:00:00Z", 1500),
    ];
    expect(deriveTodayRatingDelta(history, NOW)).toBe(0);
  });

  it("aggregates multiple entries on the same day", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-22T23:00:00Z", 1700),
      entry("2026-04-23T01:00:00Z", 1705),
      entry("2026-04-23T10:00:00Z", 1715),
      entry("2026-04-23T14:00:00Z", 1720),
    ];
    expect(deriveTodayRatingDelta(history, NOW)).toBe(20);
  });
});

describe("deriveRecentRatingDelta", () => {
  it("returns 0 for empty history", () => {
    expect(deriveRecentRatingDelta([], 7, NOW)).toBe(0);
  });

  it("returns 0 for a single entry with no prior baseline", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-23T09:00:00Z", 1500),
    ];
    expect(deriveRecentRatingDelta(history, 7, NOW)).toBe(0);
  });

  it("uses the last entry before the window as baseline", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-10T12:00:00Z", 1700),
      entry("2026-04-18T12:00:00Z", 1710),
      entry("2026-04-22T12:00:00Z", 1720),
      entry("2026-04-23T09:00:00Z", 1724),
    ];
    // Window starts 7 days before NOW (2026-04-16T15:30Z). Baseline is the
    // last entry before that boundary (index 0, rating 1700). Current is 1724.
    expect(deriveRecentRatingDelta(history, 7, NOW)).toBe(24);
  });

  it("falls back to earliest in-window entry if no prior baseline exists", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-20T12:00:00Z", 1700),
      entry("2026-04-23T09:00:00Z", 1724),
    ];
    expect(deriveRecentRatingDelta(history, 7, NOW)).toBe(24);
  });

  it("returns a negative delta when rating dropped", () => {
    const history: RatingHistoryEntry[] = [
      entry("2026-04-10T12:00:00Z", 1800),
      entry("2026-04-23T09:00:00Z", 1770),
    ];
    expect(deriveRecentRatingDelta(history, 7, NOW)).toBe(-30);
  });
});
