import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RateLimitExceededError,
  assertWithinRateLimit,
  resolveClientIp,
  resetRateLimitStoreForTests,
} from "@/lib/rate-limiting/middleware";

const LIMIT_CONFIG = {
  scope: "test:scope",
  limit: 3,
  windowMs: 10_000,
};

describe("rate-limiting middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    resetRateLimitStoreForTests();
  });

  afterEach(() => {
    resetRateLimitStoreForTests();
    vi.useRealTimers();
  });

  it("throws RateLimitExceededError after the configured limit is reached", () => {
    for (let i = 0; i < LIMIT_CONFIG.limit; i += 1) {
      assertWithinRateLimit({
        ...LIMIT_CONFIG,
        identifier: "client-a",
      });
    }

    expect(() =>
      assertWithinRateLimit({
        ...LIMIT_CONFIG,
        identifier: "client-a",
      }),
    ).toThrow(RateLimitExceededError);
  });

  it("resets counters after the window elapses", () => {
    for (let i = 0; i < LIMIT_CONFIG.limit; i += 1) {
      assertWithinRateLimit({
        ...LIMIT_CONFIG,
        identifier: "client-b",
      });
    }

    vi.advanceTimersByTime(LIMIT_CONFIG.windowMs + 1);

    expect(() =>
      assertWithinRateLimit({
        ...LIMIT_CONFIG,
        identifier: "client-b",
      }),
    ).not.toThrow();
  });

  it("tracks each identifier independently", () => {
    for (let i = 0; i < LIMIT_CONFIG.limit; i += 1) {
      assertWithinRateLimit({
        ...LIMIT_CONFIG,
        identifier: "client-c",
      });
    }

    expect(() =>
      assertWithinRateLimit({
        ...LIMIT_CONFIG,
        identifier: "client-d",
      }),
    ).not.toThrow();
  });

  it("derives IP address from headers", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    });

    expect(resolveClientIp(headers)).toBe("203.0.113.9");
  });

  it("falls back to 'unknown' when no headers match", () => {
    expect(resolveClientIp(new Headers())).toBe("unknown");
  });

  it("spec 044: match:preview-swap admits 60 previews per minute per player, then throws", () => {
    const config = { scope: "match:preview-swap", limit: 60, windowMs: 60_000, identifier: "player-a" };
    for (let i = 0; i < 60; i += 1) {
      expect(() => assertWithinRateLimit(config)).not.toThrow();
    }
    expect(() => assertWithinRateLimit(config)).toThrow(RateLimitExceededError);
    // Another player has an independent budget.
    expect(() => assertWithinRateLimit({ ...config, identifier: "player-b" })).not.toThrow();
  });
});
