import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    channel: vi.fn(() => ({
      subscribe: vi.fn(),
      send: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}));

import {
  instantScoreFirstSubmission,
  type InstantScoringResult,
} from "@/lib/match/instantScoring";

describe("instantScoreFirstSubmission — skeleton contract (T006)", () => {
  it("is an async function that accepts a single matchId parameter", () => {
    expect(typeof instantScoreFirstSubmission).toBe("function");
    expect(instantScoreFirstSubmission.length).toBe(1);
  });

  it("returns a discriminated InstantScoringResult when called against a non-existent match", async () => {
    const result: InstantScoringResult =
      await instantScoreFirstSubmission("00000000-0000-0000-0000-000000000000");

    expect(result).toBeDefined();
    expect(["fired", "deferred-to-combined", "no-score", "failed"]).toContain(
      result.status,
    );
    // Non-existent match must NOT report a successful fire.
    expect(result.status).not.toBe("fired");
  });
});
