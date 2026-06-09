import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  trackInstantScoringDeferred,
  trackInstantScoringFailed,
  trackInstantScoringFired,
} from "@/lib/observability/instantScoring";

describe("instant-scoring observability helpers (T005)", () => {
  const infoSpy = vi.spyOn(console, "log");
  const errorSpy = vi.spyOn(console, "error");

  beforeEach(() => {
    infoSpy.mockReset().mockImplementation(() => undefined);
    errorSpy.mockReset().mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockReset();
    errorSpy.mockReset();
  });

  it("trackInstantScoringFired emits an info JSON line tagged 'instant-scoring.fired'", () => {
    trackInstantScoringFired({
      matchId: "match-1",
      roundNumber: 3,
      playerId: "player-a",
      wordCount: 2,
      durationMs: 47,
    });

    expect(infoSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(payload.level).toBe("info");
    expect(payload.event).toBe("instant-scoring.fired");
    expect(payload.matchId).toBe("match-1");
    expect(payload.roundNumber).toBe(3);
    expect(payload.playerId).toBe("player-a");
    expect(payload.wordCount).toBe(2);
    expect(payload.durationMs).toBe(47);
  });

  it("trackInstantScoringDeferred emits an info JSON line tagged 'instant-scoring.deferred-to-combined'", () => {
    trackInstantScoringDeferred({
      matchId: "match-1",
      roundNumber: 3,
      reason: "race-window",
    });

    expect(infoSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(payload.event).toBe("instant-scoring.deferred-to-combined");
    expect(payload.matchId).toBe("match-1");
    expect(payload.roundNumber).toBe(3);
    expect(payload.reason).toBe("race-window");
  });

  it("trackInstantScoringFailed emits an error JSON line tagged 'instant-scoring.failed'", () => {
    trackInstantScoringFailed({
      matchId: "match-1",
      roundNumber: 3,
      playerId: "player-a",
      reason: "timeout",
    });

    expect(errorSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(payload.level).toBe("error");
    expect(payload.event).toBe("instant-scoring.failed");
    expect(payload.matchId).toBe("match-1");
    expect(payload.roundNumber).toBe(3);
    expect(payload.playerId).toBe("player-a");
    expect(payload.reason).toBe("timeout");
  });
});
