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

vi.mock("@/lib/game-engine/dictionary", () => ({
  loadDictionary: vi.fn().mockResolvedValue(new Set(["orð"])),
}));

import { computeWordScoresForRound } from "@/app/actions/match/publishRoundSummary";
import { instantScoreFirstSubmission } from "@/lib/match/instantScoring";
import { trackInstantScoringFailed } from "@/lib/observability/instantScoring";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const ROUND_ID = "22222222-2222-2222-2222-222222222222";
const PLAYER_A = "33333333-3333-3333-3333-333333333333";
const PLAYER_B = "44444444-4444-4444-4444-444444444444";
const SUBMITTED_AT = "2026-06-09T12:00:00.000Z";
const CURRENT_ROUND = 4;

function createBoard(): string[][] {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => "A"),
  );
}

/** Happy-path client with a single pending submission on round `CURRENT_ROUND`. */
function makeClient() {
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
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: MATCH_ID,
                current_round: CURRENT_ROUND,
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                board_seed: "seed-1",
                frozen_tiles: {},
              },
              error: null,
            }),
          })),
        };
      }
      if (table === "rounds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: ROUND_ID,
                state: "collecting",
                board_snapshot_before: createBoard(),
                started_at: new Date().toISOString(),
                frozen_tiles_before: {},
              },
              error: null,
            }),
          })),
        };
      }
      if (table === "move_submissions") {
        const chain: Record<string, unknown> = {};
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
 * The fast path times out ~every move in production (21 `instant-scoring.failed
 * reason:"timeout"` in one 6-minute match, 2026-07-31) and the log line carries
 * neither the round it belongs to nor any indication of WHERE the budget went.
 * Without those two things the failure cannot be attributed to the dictionary,
 * the Supabase round-trips, or `publishMatchState`.
 */
describe("instantScoreFirstSubmission — timeout diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("reports the real round number on timeout, not 0", async () => {
    vi.useFakeTimers();
    vi.mocked(getServiceRoleClient).mockReturnValue(makeClient() as never);
    // Scoring never settles — the timeout branch wins the race.
    vi.mocked(computeWordScoresForRound).mockImplementation(
      () => new Promise(() => {}) as never,
    );

    const resultPromise = instantScoreFirstSubmission(MATCH_ID);
    await vi.advanceTimersByTimeAsync(6_000);
    const result = await resultPromise;

    expect(result.status).toBe("failed");
    expect(trackInstantScoringFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: MATCH_ID,
        roundNumber: CURRENT_ROUND,
        reason: "timeout",
      }),
    );
  });

  it("reports which phase the fast path stalled in, with per-phase timings", async () => {
    vi.useFakeTimers();
    vi.mocked(getServiceRoleClient).mockReturnValue(makeClient() as never);
    vi.mocked(computeWordScoresForRound).mockImplementation(
      () => new Promise(() => {}) as never,
    );

    const resultPromise = instantScoreFirstSubmission(MATCH_ID);
    await vi.advanceTimersByTimeAsync(6_000);
    await resultPromise;

    const payload = vi.mocked(trackInstantScoringFailed).mock.calls[0]?.[0];
    // Everything up to the scoring call completed, so the stall is attributable
    // to `scoring` and the earlier phases must each have a recorded duration.
    expect(payload?.lastPhase).toBe("recheck");
    expect(payload?.phases).toEqual(
      expect.objectContaining({
        "match-loaded": expect.any(Number),
        "round-loaded": expect.any(Number),
        "submissions-loaded": expect.any(Number),
        "dictionary-warmed": expect.any(Number),
        recheck: expect.any(Number),
      }),
    );
  });

  it("reports phase timings on the success path too, for a healthy baseline", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(makeClient() as never);
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [
        {
          playerId: PLAYER_A,
          word: "orð",
          length: 3,
          lettersPoints: 5,
          bonusPoints: 5,
          totalPoints: 10,
          coordinates: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
          ],
        },
      ],
      finalBoard: createBoard(),
      newFrozenTiles: {},
    } as never);

    const { trackInstantScoringFired } = await import(
      "@/lib/observability/instantScoring"
    );
    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result.status).toBe("fired");
    const payload = vi.mocked(trackInstantScoringFired).mock.calls[0]?.[0];
    expect(payload?.phases).toEqual(
      expect.objectContaining({
        "match-loaded": expect.any(Number),
        "dictionary-warmed": expect.any(Number),
        scoring: expect.any(Number),
        published: expect.any(Number),
      }),
    );
  });
});
