import { describe, expect, test } from "vitest";

import { MATCH_CLOCK_BUDGET_MS, clockPhase, formatClock, isLowClock, laneFraction } from "@/lib/room/clock";

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

describe("clockPhase (the ledger clock, 2026-09-21)", () => {
  test("calm from 1:00 up, low under a minute, flash in the last 15 seconds, spent at 0:00", () => {
    expect(clockPhase(192_000)).toBe("calm");
    expect(clockPhase(60_000)).toBe("calm");
    expect(clockPhase(59_999)).toBe("low");
    expect(clockPhase(15_001)).toBe("low");
    expect(clockPhase(15_000)).toBe("flash");
    expect(clockPhase(1)).toBe("flash");
    expect(clockPhase(0)).toBe("spent");
  });
});

