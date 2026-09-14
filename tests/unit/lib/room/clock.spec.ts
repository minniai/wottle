import { describe, expect, test } from "vitest";

import { MATCH_CLOCK_BUDGET_MS, formatClock, isLowClock, laneFraction } from "@/lib/room/clock";

describe("room clock helpers", () => {
  test("budget is 5:00 per player (decision Q1)", () => {
    expect(MATCH_CLOCK_BUDGET_MS).toBe(300_000);
  });

  test("isLowClock is true strictly under one minute", () => {
    expect(isLowClock(59_999)).toBe(true);
    expect(isLowClock(60_000)).toBe(false);
    expect(isLowClock(0)).toBe(true);
  });

  test("formatClock renders m:ss and clamps at 0:00", () => {
    expect(formatClock(300_000)).toBe("5:00");
    expect(formatClock(65_400)).toBe("1:05");
    expect(formatClock(999)).toBe("0:00");
    expect(formatClock(-5)).toBe("0:00");
  });

  test("laneFraction is remaining over budget, clamped to 0..1", () => {
    expect(laneFraction(150_000)).toBe(0.5);
    expect(laneFraction(600_000)).toBe(1);
    expect(laneFraction(-1)).toBe(0);
  });
});
