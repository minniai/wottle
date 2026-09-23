import { describe, expect, test } from "vitest";

import { MATCH_CLOCK_BUDGET_MS, behindPace, clockBlocks, clockRowPhase, formatClock, isLowClock, pace, serverCorrectedNow, ticksLeft } from "@/lib/room/clock";

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

});

describe("the scoreboard's clock row (spec 068)", () => {
  test("one tick empties every 5s: 3:12 is 39 ticks", () => {
    expect(ticksLeft(192_000)).toBe(39);
    expect(ticksLeft(300_000)).toBe(60);
    expect(ticksLeft(4_001)).toBe(1);
    expect(ticksLeft(0)).toBe(0);
    expect(ticksLeft(-5)).toBe(0);
  });

  test("ten 30s blocks of six ticks, emptying from the right", () => {
    expect(clockBlocks(39)).toEqual([6, 6, 6, 6, 6, 6, 3, 0, 0, 0]);
    expect(clockBlocks(60)).toEqual(Array(10).fill(6));
    expect(clockBlocks(0)).toEqual(Array(10).fill(0));
  });

  test("the phases are weight only: running, under a minute, the last 15s, time", () => {
    expect(clockRowPhase(192_000)).toBe("running");
    expect(clockRowPhase(60_000)).toBe("running");
    expect(clockRowPhase(59_999)).toBe("underMinute");
    expect(clockRowPhase(15_000)).toBe("lastSeconds");
    expect(clockRowPhase(1)).toBe("lastSeconds");
    expect(clockRowPhase(0)).toBe("time");
  });

  test("the pace is the time left per move left, in whole seconds", () => {
    expect(pace(192_000, 7)).toBe(27);
    expect(pace(48_000, 3)).toBe(16);
    expect(pace(800, 3)).toBe(0);
    expect(pace(10_000, 0)).toBeNull();
  });

  test("behind pace: short of a full 30s block per move left", () => {
    expect(behindPace(3, 48_000)).toBe(true); // 1.6 blocks for 3 moves
    expect(behindPace(7, 192_000)).toBe(false); // 6.4 blocks for 7 moves
    expect(behindPace(7, 180_000)).toBe(true); // exactly one block short
    expect(behindPace(1, 0)).toBe(true);
    expect(behindPace(0, 0)).toBe(false); // nothing left to play
  });

  test("the server-corrected now shifts the device clock by the snapshot's drift", () => {
    const serverNow = "2026-09-23T12:00:10.000Z";
    const localAtSnapshot = new Date("2026-09-23T12:00:00.000Z").getTime();
    expect(serverCorrectedNow(serverNow, localAtSnapshot, localAtSnapshot + 5_000)).toBe(new Date("2026-09-23T12:00:15.000Z").getTime());
  });
});
