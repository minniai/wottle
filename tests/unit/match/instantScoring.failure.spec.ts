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
import { trackInstantScoringFailed } from "@/lib/observability/instantScoring";
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

function makeOneSubmissionClient() {
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

describe("instantScoreFirstSubmission — failure modes (T019a, FR-011)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServiceRoleClient).mockReturnValue(makeOneSubmissionClient() as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns {status:'failed'} when computeWordScoresForRound throws synchronously", async () => {
    vi.mocked(computeWordScoresForRound).mockRejectedValue(
      new Error("dictionary load failed"),
    );

    let thrown: unknown = null;
    let result: Awaited<ReturnType<typeof instantScoreFirstSubmission>> | null = null;
    try {
      result = await instantScoreFirstSubmission(MATCH_ID);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeNull();
    expect(result?.status).toBe("failed");
    if (result?.status === "failed") {
      expect(result.reason).toMatch(/dictionary|scoring|threw/i);
    }
    expect(publishMatchState).not.toHaveBeenCalled();
    expect(trackInstantScoringFailed).toHaveBeenCalledOnce();
    const failedCall = vi.mocked(trackInstantScoringFailed).mock.calls[0][0];
    expect(failedCall.matchId).toBe(MATCH_ID);
  });

  it("returns {status:'failed', reason:'timeout'} when scoring hangs past the 500 ms budget", async () => {
    vi.useFakeTimers();

    const resolveRef: { current: ((v: unknown) => void) | null } = { current: null };
    vi.mocked(computeWordScoresForRound).mockImplementation(
      () => new Promise((resolve) => { resolveRef.current = resolve as (v: unknown) => void; }) as never,
    );

    const resultPromise = instantScoreFirstSubmission(MATCH_ID);
    await vi.advanceTimersByTimeAsync(600);
    const result = await resultPromise;

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe("timeout");
    }
    expect(publishMatchState).not.toHaveBeenCalled();
    expect(trackInstantScoringFailed).toHaveBeenCalledOnce();
    const failedCall = vi.mocked(trackInstantScoringFailed).mock.calls[0][0];
    expect(failedCall.reason).toBe("timeout");

    resolveRef.current?.({ wordScores: [], finalBoard: createBoard() });
    vi.useRealTimers();
  });

  it("does NOT throw out of the function so submitMove's after() hook can still call advanceRound", async () => {
    vi.mocked(computeWordScoresForRound).mockRejectedValue(
      new Error("boom"),
    );

    await expect(
      instantScoreFirstSubmission(MATCH_ID),
    ).resolves.toBeDefined();
  });
});
