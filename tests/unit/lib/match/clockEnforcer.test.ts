import { describe, expect, it } from "vitest";

// T011: These tests will FAIL until lib/match/clockEnforcer.ts is created
import {
  computeRemainingMs,
  isClockExpired,
  computeElapsedMs,
} from "@/lib/match/clockEnforcer";

describe("clockEnforcer", () => {
  describe("computeRemainingMs", () => {
    it("returns storedRemainingMs when elapsed is zero (round just started)", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const now = new Date("2026-01-01T00:00:00Z"); // same instant
      expect(computeRemainingMs(roundStartedAt, 60_000, now)).toBe(60_000);
    });

    it("reduces remaining by elapsed time", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const now = new Date("2026-01-01T00:00:10Z"); // 10 seconds later
      expect(computeRemainingMs(roundStartedAt, 60_000, now)).toBe(50_000);
    });

    it("clamps to 0 when elapsed exceeds stored remaining", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const now = new Date("2026-01-01T00:02:00Z"); // 2 minutes later, stored is 1 min
      expect(computeRemainingMs(roundStartedAt, 60_000, now)).toBe(0);
    });

    it("uses current time when now param is omitted", () => {
      // Using a very old start time ensures remaining is 0
      const ancientStart = new Date("2020-01-01T00:00:00Z");
      expect(computeRemainingMs(ancientStart, 60_000)).toBe(0);
    });
  });

  describe("isClockExpired", () => {
    it("returns false when time remains", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const now = new Date("2026-01-01T00:00:30Z"); // 30s elapsed, 60s stored
      expect(isClockExpired(roundStartedAt, 60_000, now)).toBe(false);
    });

    it("returns true when remaining is exactly 0", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const now = new Date("2026-01-01T00:01:00Z"); // exactly 60s elapsed
      expect(isClockExpired(roundStartedAt, 60_000, now)).toBe(true);
    });

    it("returns true when remaining is negative (elapsed > stored)", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const now = new Date("2026-01-01T00:02:00Z"); // 120s elapsed, only 60s stored
      expect(isClockExpired(roundStartedAt, 60_000, now)).toBe(true);
    });

    it("injectable now enables deterministic tests", () => {
      const start = new Date(1000);
      const expired = new Date(61_001);  // 60001ms elapsed > 60000ms stored
      const notExpired = new Date(59_999 + 1000); // 59999ms elapsed < 60000ms stored
      expect(isClockExpired(start, 60_000, expired)).toBe(true);
      expect(isClockExpired(start, 60_000, notExpired)).toBe(false);
    });
  });

  describe("computeElapsedMs", () => {
    it("returns the difference between submittedAt and roundStartedAt", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const submittedAt = new Date("2026-01-01T00:00:45Z"); // 45s later
      expect(computeElapsedMs(roundStartedAt, submittedAt)).toBe(45_000);
    });

    it("returns 0 when submitted at round start", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      expect(computeElapsedMs(roundStartedAt, roundStartedAt)).toBe(0);
    });

    it("handles large elapsed times correctly", () => {
      const roundStartedAt = new Date("2026-01-01T00:00:00Z");
      const submittedAt = new Date("2026-01-01T00:05:00Z"); // 5 minutes
      expect(computeElapsedMs(roundStartedAt, submittedAt)).toBe(300_000);
    });
  });
});
