import { describe, expect, test, vi } from "vitest";

import { withRetry, ScoringPipelineError } from "@/lib/game-engine/retry";

describe("withRetry (T046, FR-026)", () => {
  test("should return result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("should retry on failure and succeed on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("should retry up to maxAttempts times", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new Error("persistent failure"));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow(ScoringPipelineError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("should throw ScoringPipelineError with message after exhaustion", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("DB error"));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow(/scoring pipeline failed after 3 attempts/i);
  });

  test("should include original error as cause in ScoringPipelineError", async () => {
    const originalError = new Error("Connection refused");
    const fn = vi.fn().mockRejectedValue(originalError);

    try {
      await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ScoringPipelineError);
      expect((error as ScoringPipelineError).cause).toBe(originalError);
    }
  });

  test("should apply exponential backoff between retries", async () => {
    const timestamps: number[] = [];
    const fn = vi
      .fn()
      .mockImplementation(() => {
        timestamps.push(Date.now());
        if (timestamps.length < 3) {
          return Promise.reject(new Error("fail"));
        }
        return Promise.resolve("success");
      });

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);

    // Verify delays increase (first retry ~50ms, second ~100ms)
    const delay1 = timestamps[1] - timestamps[0];
    const delay2 = timestamps[2] - timestamps[1];
    expect(delay1).toBeGreaterThanOrEqual(40); // ~50ms with tolerance
    expect(delay2).toBeGreaterThanOrEqual(80); // ~100ms with tolerance
    expect(delay2).toBeGreaterThan(delay1); // Exponential: second delay > first
  });

  test("should call onRetry callback on each retry", async () => {
    const onRetry = vi.fn();
    const error1 = new Error("fail 1");
    const error2 = new Error("fail 2");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValue("success");

    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, error1);
    expect(onRetry).toHaveBeenCalledWith(2, error2);
  });

  test("should call onExhausted callback when all retries fail", async () => {
    const onExhausted = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValue(new Error("permanent failure"));

    try {
      await withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 1,
        onExhausted,
      });
    } catch {
      // expected
    }

    expect(onExhausted).toHaveBeenCalledTimes(1);
    expect(onExhausted).toHaveBeenCalledWith(
      expect.any(ScoringPipelineError),
    );
  });

  test("should default to 3 maxAttempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    try {
      await withRetry(fn, { baseDelayMs: 1 });
    } catch {
      // expected
    }

    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("ScoringPipelineError", () => {
  test("should be an instance of Error", () => {
    const error = new ScoringPipelineError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ScoringPipelineError");
  });

  test("should store the cause and attempt count", () => {
    const cause = new Error("DB error");
    const error = new ScoringPipelineError("Pipeline failed", cause, 3);
    expect(error.cause).toBe(cause);
    expect(error.attempts).toBe(3);
  });
});
