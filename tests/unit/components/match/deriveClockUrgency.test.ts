import { describe, expect, test } from "vitest";

import { deriveClockUrgency } from "@/components/match/deriveClockUrgency";

describe("deriveClockUrgency", () => {
  test("running clock above 30s is calm/active with no urgency", () => {
    expect(deriveClockUrgency("running", 31)).toEqual({
      tone: "active",
      urgency: 0,
    });
    expect(deriveClockUrgency("running", 120)).toEqual({
      tone: "active",
      urgency: 0,
    });
  });

  test("running clock at 30s enters warning at zero urgency", () => {
    expect(deriveClockUrgency("running", 30)).toEqual({
      tone: "warning",
      urgency: 0,
    });
  });

  test("warning urgency ramps from 0 at 30s toward 1 at 0s", () => {
    // 16s → (30-16)/30 = 0.466…
    const r = deriveClockUrgency("running", 16);
    expect(r.tone).toBe("warning");
    expect(r.urgency).toBeCloseTo(14 / 30, 5);
  });

  test("running clock at 15s becomes critical (blinking threshold)", () => {
    const r = deriveClockUrgency("running", 15);
    expect(r.tone).toBe("critical");
    expect(r.urgency).toBeCloseTo(15 / 30, 5);
  });

  test("critical urgency approaches 1 near zero", () => {
    const r = deriveClockUrgency("running", 1);
    expect(r.tone).toBe("critical");
    expect(r.urgency).toBeCloseTo(29 / 30, 5);
  });

  test("zero or negative running time is expired at full urgency", () => {
    expect(deriveClockUrgency("running", 0)).toEqual({
      tone: "expired",
      urgency: 1,
    });
    expect(deriveClockUrgency("running", -5)).toEqual({
      tone: "expired",
      urgency: 1,
    });
  });

  test("expired status is expired regardless of seconds", () => {
    expect(deriveClockUrgency("expired", 40)).toEqual({
      tone: "expired",
      urgency: 1,
    });
  });

  test("paused clock is waiting and never gradients or blinks", () => {
    expect(deriveClockUrgency("paused", 10)).toEqual({
      tone: "waiting",
      urgency: 0,
    });
    expect(deriveClockUrgency("paused", 120)).toEqual({
      tone: "waiting",
      urgency: 0,
    });
  });

  test("urgency is clamped to [0, 1]", () => {
    expect(deriveClockUrgency("running", 30).urgency).toBe(0);
    expect(deriveClockUrgency("running", 1).urgency).toBeLessThanOrEqual(1);
    expect(deriveClockUrgency("running", 1).urgency).toBeGreaterThanOrEqual(0);
  });
});
