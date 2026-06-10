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
import { loadDictionary } from "@/lib/game-engine/dictionary";
import { instantScoreFirstSubmission } from "@/lib/match/instantScoring";
import {
  trackInstantScoringDeferred,
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

const SCORED_WORD = {
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
};

/**
 * Client whose rounds table reports `firstRoundState` on the initial full-row
 * load and `recheckRoundState` on every subsequent rounds query (the pre-write
 * recheck). All other tables behave like the happy-path single-submission case.
 */
function makeClient({
  firstRoundState = "collecting",
  recheckRoundState = "collecting",
}: { firstRoundState?: string; recheckRoundState?: string } = {}) {
  let roundsQueryCount = 0;
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
                current_round: 1,
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
        roundsQueryCount += 1;
        const state = roundsQueryCount === 1 ? firstRoundState : recheckRoundState;
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: ROUND_ID,
                state,
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

describe("instantScoreFirstSubmission — production cold-start budget (O-71)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("still fires when scoring takes 1.5 s (cold serverless instance)", async () => {
    // Linear O-71 regression: in production every move can land on a cold
    // lambda where the 52 MB Icelandic dictionary takes >1.4 s to load, so a
    // 500 ms budget meant the fast path NEVER fired and the instant scoring
    // reveal silently disappeared. The budget must absorb a realistic
    // cold-start scoring pass.
    vi.useFakeTimers();
    vi.mocked(getServiceRoleClient).mockReturnValue(makeClient() as never);
    vi.mocked(computeWordScoresForRound).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                wordScores: [SCORED_WORD],
                finalBoard: createBoard(),
                newFrozenTiles: {},
              }),
            1_500,
          );
        }) as never,
    );

    const resultPromise = instantScoreFirstSubmission(MATCH_ID);
    await vi.advanceTimersByTimeAsync(1_600);
    const result = await resultPromise;

    expect(result.status).toBe("fired");
    expect(publishMatchState).toHaveBeenCalledWith(MATCH_ID);
    expect(trackInstantScoringFired).toHaveBeenCalledOnce();
  });

  it("warms the dictionary before invoking the scoring pipeline", async () => {
    // The dictionary load is the dominant cold-start cost. Warming it first
    // keeps the window between the round-state recheck and the destructive
    // delete-then-insert write to a few fast DB round-trips.
    vi.mocked(getServiceRoleClient).mockReturnValue(makeClient() as never);
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [SCORED_WORD],
      finalBoard: createBoard(),
      newFrozenTiles: {},
    });

    await instantScoreFirstSubmission(MATCH_ID);

    expect(loadDictionary).toHaveBeenCalled();
    const dictionaryOrder = vi.mocked(loadDictionary).mock
      .invocationCallOrder[0];
    const scoringOrder = vi.mocked(computeWordScoresForRound).mock
      .invocationCallOrder[0];
    expect(dictionaryOrder).toBeLessThan(scoringOrder);
  });

  it("defers without writing when the round left 'collecting' after the initial load (orphan guard, O-58/O-70)", async () => {
    // A fast path that loses the internal timeout race keeps running detached
    // and, on a thawed lambda, used to execute computeWordScoresForRound's
    // delete-then-insert AFTER the combined path had already written the
    // round's canonical entries — deleting both players' words and
    // re-inserting only the first mover's. The pre-write recheck must abort
    // before any write once the round is no longer collecting.
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({ recheckRoundState: "resolving" }) as never,
    );

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result.status).toBe("deferred-to-combined");
    expect(computeWordScoresForRound).not.toHaveBeenCalled();
    expect(publishMatchState).not.toHaveBeenCalled();
    expect(trackInstantScoringDeferred).toHaveBeenCalledOnce();
  });
});
