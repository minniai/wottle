import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));

vi.mock("@/app/actions/match/publishRoundSummary", () => ({
  computeWordScoresForRound: vi.fn(),
}));

vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/observability/instantScoring", () => ({
  trackInstantScoringFired: vi.fn(),
  trackInstantScoringDeferred: vi.fn(),
  trackInstantScoringFailed: vi.fn(),
}));

import { computeWordScoresForRound } from "@/app/actions/match/publishRoundSummary";
import { instantScoreFirstSubmission } from "@/lib/match/instantScoring";
import {
  trackInstantScoringDeferred,
  trackInstantScoringFailed,
  trackInstantScoringFired,
} from "@/lib/observability/instantScoring";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const ROUND_ID = "22222222-2222-2222-2222-222222222222";
const PLAYER_A = "33333333-3333-3333-3333-333333333333";
const PLAYER_B = "44444444-4444-4444-4444-444444444444";
const SUBMITTED_AT = "2026-06-09T12:00:00.000Z";

function createBoard(): string[][] {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => "A"),
  );
}

function makeClientWithTwoPending() {
  const matchData = {
    id: MATCH_ID,
    current_round: 1,
    player_a_id: PLAYER_A,
    player_b_id: PLAYER_B,
    board_seed: "seed-1",
    frozen_tiles: {},
  };
  const roundData = {
    id: ROUND_ID,
    state: "collecting",
    board_snapshot_before: createBoard(),
    started_at: new Date().toISOString(),
  };
  const submissionRows = [
    {
      id: "sub-1",
      player_id: PLAYER_A,
      from_x: 0,
      from_y: 0,
      to_x: 1,
      to_y: 0,
      submitted_at: SUBMITTED_AT,
      status: "pending",
    },
    {
      id: "sub-2",
      player_id: PLAYER_B,
      from_x: 5,
      from_y: 5,
      to_x: 6,
      to_y: 5,
      submitted_at: SUBMITTED_AT,
      status: "pending",
    },
  ];

  return {
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: matchData, error: null }),
            single: vi.fn().mockResolvedValue({ data: matchData, error: null }),
          })),
        };
      }
      if (table === "rounds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: roundData, error: null }),
            single: vi.fn().mockResolvedValue({ data: roundData, error: null }),
          })),
        };
      }
      if (table === "move_submissions") {
        // chain: any — matches the mock-chain pattern in
        // instantScoring.happyPath.spec.ts; vi.fn's recursive return type
        // isn't expressible without `any` here.
        const chain: any = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.order = vi.fn(() =>
          Promise.resolve({ data: submissionRows, error: null }),
        );
        return chain;
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }),
  };
}

/**
 * Spec 042 / US4 / FR-007 — race-window guard.
 *
 * When two pending submissions already exist by the time the fast path
 * runs, it MUST no-op (defer to combined). Verifies:
 *   • return = { status: "deferred-to-combined", reason: "race-window" }
 *   • computeWordScoresForRound NOT called
 *   • publishMatchState NOT called
 *   • trackInstantScoringDeferred fires exactly once with reason "race-window"
 *   • neither fired nor failed log fires
 */
describe("instantScoreFirstSubmission — race-window guard (T037, FR-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defers to combined when 2 pending submissions already exist", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClientWithTwoPending() as never,
    );

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result).toEqual({
      status: "deferred-to-combined",
      reason: "race-window",
    });
  });

  it("does NOT invoke the scoring pipeline when deferring", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClientWithTwoPending() as never,
    );

    await instantScoreFirstSubmission(MATCH_ID);

    expect(computeWordScoresForRound).not.toHaveBeenCalled();
  });

  it("does NOT broadcast match state when deferring", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClientWithTwoPending() as never,
    );

    await instantScoreFirstSubmission(MATCH_ID);

    expect(publishMatchState).not.toHaveBeenCalled();
  });

  it("emits trackInstantScoringDeferred(reason=race-window) exactly once and no other log events", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClientWithTwoPending() as never,
    );

    await instantScoreFirstSubmission(MATCH_ID);

    expect(trackInstantScoringDeferred).toHaveBeenCalledOnce();
    expect(vi.mocked(trackInstantScoringDeferred).mock.calls[0][0]).toMatchObject({
      matchId: MATCH_ID,
      roundNumber: 1,
      reason: "race-window",
    });
    expect(trackInstantScoringFired).not.toHaveBeenCalled();
    expect(trackInstantScoringFailed).not.toHaveBeenCalled();
  });
});
