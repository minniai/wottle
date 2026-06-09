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

function makeClientWithOnePending() {
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
 * Spec 042 / US5 / FR-006 — zero-score no-op fast path.
 *
 * When the first submission scores zero words, the fast path MUST:
 *   • return { status: "no-score", reason: "swap-produced-no-words" }
 *   • NOT broadcast match state (no UI change for opponent)
 *   • emit NO log events (zero-score is a non-event, not worth a structured log;
 *     it's the most common round outcome and would otherwise flood logs)
 */
describe("instantScoreFirstSubmission — zero-score branch (T043, FR-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns no-score with reason 'swap-produced-no-words' when the swap yields zero words", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClientWithOnePending() as never,
    );
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [],
      finalBoard: createBoard(),
    });

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result).toEqual({
      status: "no-score",
      reason: "swap-produced-no-words",
    });
  });

  it("does NOT broadcast match state when the swap produces no words", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClientWithOnePending() as never,
    );
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [],
      finalBoard: createBoard(),
    });

    await instantScoreFirstSubmission(MATCH_ID);

    expect(publishMatchState).not.toHaveBeenCalled();
  });

  it("emits NO log events on the zero-score path (most common round outcome)", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClientWithOnePending() as never,
    );
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [],
      finalBoard: createBoard(),
    });

    await instantScoreFirstSubmission(MATCH_ID);

    expect(trackInstantScoringFired).not.toHaveBeenCalled();
    expect(trackInstantScoringFailed).not.toHaveBeenCalled();
    expect(trackInstantScoringDeferred).not.toHaveBeenCalled();
  });
});
