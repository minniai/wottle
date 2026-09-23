import { describe, expect, it } from "vitest";

import {
  ACTIVATION_GUARD_MS,
  AWAY_AFTER_MS,
  CHALLENGE_LIMIT_PER_MINUTE,
  CHALLENGE_TTL_MS,
  DECLINE_COOLDOWN_MS,
  HEARTBEAT_HIDDEN_MS,
  HEARTBEAT_VISIBLE_MS,
  LEAVING_GRACE_MS,
  LEAVING_RECHECK_MS,
  OUTCOME_HOLD_MS,
  ACCEPTED_HOLD_MS,
  POLL_FALLBACK_MS,
  POLL_LIVE_MS,
  RECENT_INPUT_MS,
  SILENCE_AFTER_DECLINES,
  SILENCE_FOR_MS,
  SILENCE_WINDOW_MS,
  goneAfterMs,
} from "@/lib/presence/constants";

/** Spec 070 FR-032: one module of presence and challenge timings, shared by client and server. */
describe("presence constants (spec 070 FR-032)", () => {
  it("beats every 10s while visible and every 30s while hidden", () => {
    expect(HEARTBEAT_VISIBLE_MS).toBe(10_000);
    expect(HEARTBEAT_HIDDEN_MS).toBe(30_000);
  });

  it("drops a tab after three missed beats of its cadence, plus 5s", () => {
    expect(goneAfterMs(HEARTBEAT_VISIBLE_MS)).toBe(35_000);
    expect(goneAfterMs(HEARTBEAT_HIDDEN_MS)).toBe(95_000);
  });

  it("is away after 2:00 hidden, and a leaving tab has 8s to come back", () => {
    expect(AWAY_AFTER_MS).toBe(120_000);
    expect(LEAVING_GRACE_MS).toBe(8_000);
    expect(LEAVING_RECHECK_MS).toBeGreaterThan(LEAVING_GRACE_MS);
  });

  it("counts input in the last 30s as attention (spec 069)", () => {
    expect(RECENT_INPUT_MS).toBe(30_000);
  });

  it("gives a challenge 60s, a declined pair 60s, and a sender 6 a minute", () => {
    expect(CHALLENGE_TTL_MS).toBe(60_000);
    expect(DECLINE_COOLDOWN_MS).toBe(60_000);
    expect(CHALLENGE_LIMIT_PER_MINUTE).toBe(6);
  });

  it("silences a challenger declined three times in 10 minutes, for the session's 4 hours", () => {
    expect(SILENCE_AFTER_DECLINES).toBe(3);
    expect(SILENCE_WINDOW_MS).toBe(600_000);
    expect(SILENCE_FOR_MS).toBe(4 * 3_600_000);
  });

  it("holds an outcome 4s (accepted 400ms) and guards a new control 500ms", () => {
    expect(OUTCOME_HOLD_MS).toBe(4_000);
    expect(ACCEPTED_HOLD_MS).toBe(400);
    expect(ACTIVATION_GUARD_MS).toBe(500);
  });

  it("polls every 3s without the socket and every 12s with it", () => {
    expect(POLL_FALLBACK_MS).toBe(3_000);
    expect(POLL_LIVE_MS).toBe(12_000);
  });
});
