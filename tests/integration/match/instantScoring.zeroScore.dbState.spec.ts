/**
 * Spec 042 / US5 / T044 — zero-score DB state integration.
 *
 * Exercises the full instant-scoring pipeline end-to-end (instantScoring ->
 * computeWordScoresForRound -> executeScoringPipeline -> processRoundScoring)
 * with the wordEngine mocked to return zero scored words. Asserts that NO
 * persistence operations fire:
 *   - `word_score_entries.delete` is NOT called
 *   - `word_score_entries.insert` is NOT called
 *   - `matches.update` / `update_frozen_tiles_if_unchanged` RPC is NOT called
 *   - `publishMatchState` is NOT called
 *
 * Higher coverage than the unit test (which mocks computeWordScoresForRound
 * directly) because this proves the short-circuit in `executeScoringPipeline`
 * at `app/actions/match/publishRoundSummary.ts:404-406` is reached.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/observability/instantScoring", () => ({
  trackInstantScoringFired: vi.fn(),
  trackInstantScoringDeferred: vi.fn(),
  trackInstantScoringFailed: vi.fn(),
}));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/observability/log", () => ({
  logPlaytestError: vi.fn(),
  logPlaytestInfo: vi.fn(),
  trackMatchResult: vi.fn(),
  trackRoundCompleted: vi.fn(),
}));

// Critical: mock the wordEngine to return zero scored words. The whole
// pipeline must short-circuit on this without touching the DB.
vi.mock("@/lib/game-engine/wordEngine", () => ({
  processRoundScoring: vi.fn().mockResolvedValue({
    playerAWords: [],
    playerBWords: [],
    finalBoard: Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => "A"),
    ),
    newFrozenTiles: {},
  }),
}));

import { instantScoreFirstSubmission } from "@/lib/match/instantScoring";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const ROUND_ID = "22222222-2222-2222-2222-222222222222";
const PLAYER_A = "33333333-3333-3333-3333-333333333333";
const PLAYER_B = "44444444-4444-4444-4444-444444444444";
const SUBMITTED_AT = "2026-06-09T12:00:00.000Z";
const INITIAL_FROZEN_TILES = { "9,9": { owner: "player_a" } };

function createBoard(): string[][] {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => "A"),
  );
}

interface CapturedCalls {
  wordScoreEntriesDeleteCalls: number;
  wordScoreEntriesInsertCalls: number;
  matchesUpdateCalls: number;
  rpcCalls: number;
}

function makeClient(): {
  client: ReturnType<typeof getServiceRoleClient>;
  captured: CapturedCalls;
} {
  const captured: CapturedCalls = {
    wordScoreEntriesDeleteCalls: 0,
    wordScoreEntriesInsertCalls: 0,
    matchesUpdateCalls: 0,
    rpcCalls: 0,
  };

  const matchData = {
    id: MATCH_ID,
    current_round: 1,
    player_a_id: PLAYER_A,
    player_b_id: PLAYER_B,
    board_seed: "seed-1",
    frozen_tiles: INITIAL_FROZEN_TILES,
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

  const fromImpl = vi.fn((table: string) => {
    if (table === "matches") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: matchData, error: null }),
          single: vi.fn().mockResolvedValue({ data: matchData, error: null }),
        })),
        update: vi.fn(() => {
          captured.matchesUpdateCalls += 1;
          return { eq: vi.fn().mockResolvedValue({ error: null }) };
        }),
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
    if (table === "word_score_entries") {
      return {
        delete: vi.fn(() => {
          captured.wordScoreEntriesDeleteCalls += 1;
          return { eq: vi.fn().mockResolvedValue({ error: null }) };
        }),
        insert: vi.fn(() => {
          captured.wordScoreEntriesInsertCalls += 1;
          return Promise.resolve({ error: null });
        }),
      };
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    };
  });

  const rpc = vi.fn(() => {
    captured.rpcCalls += 1;
    return Promise.resolve({ data: 1, error: null });
  });

  return {
    client: { from: fromImpl, rpc } as never,
    captured,
  };
}

describe("Spec 042 US5 / T044 — zero-score path writes nothing to the DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'no-score' end-to-end when the wordEngine produces no words", async () => {
    const { client } = makeClient();
    vi.mocked(getServiceRoleClient).mockReturnValue(client);

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result).toEqual({
      status: "no-score",
      reason: "swap-produced-no-words",
    });
  });

  it("does NOT call word_score_entries.delete or .insert when zero words score", async () => {
    const { client, captured } = makeClient();
    vi.mocked(getServiceRoleClient).mockReturnValue(client);

    await instantScoreFirstSubmission(MATCH_ID);

    expect(captured.wordScoreEntriesDeleteCalls).toBe(0);
    expect(captured.wordScoreEntriesInsertCalls).toBe(0);
  });

  it("does NOT mutate matches.frozen_tiles when zero words score", async () => {
    const { client, captured } = makeClient();
    vi.mocked(getServiceRoleClient).mockReturnValue(client);

    await instantScoreFirstSubmission(MATCH_ID);

    expect(captured.matchesUpdateCalls).toBe(0);
    expect(captured.rpcCalls).toBe(0);
  });

  it("does NOT broadcast match state on the zero-score path", async () => {
    const { client } = makeClient();
    vi.mocked(getServiceRoleClient).mockReturnValue(client);

    await instantScoreFirstSubmission(MATCH_ID);

    expect(publishMatchState).not.toHaveBeenCalled();
  });
});
