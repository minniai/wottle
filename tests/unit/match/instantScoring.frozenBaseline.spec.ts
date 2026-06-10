import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const ROUND_ID = "22222222-2222-2222-2222-222222222222";
const PLAYER_A = "33333333-3333-3333-3333-333333333333";
const PLAYER_B = "44444444-4444-4444-4444-444444444444";

function createBoard(): string[][] {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => "A"),
  );
}

function makeClient(opts: {
  matchFrozenTiles: Record<string, unknown>;
  roundFrozenTilesBefore: Record<string, unknown> | null;
}) {
  const matchData = {
    id: MATCH_ID,
    current_round: 2,
    player_a_id: PLAYER_A,
    player_b_id: PLAYER_B,
    board_seed: "seed-1",
    frozen_tiles: opts.matchFrozenTiles,
  };
  const roundData = {
    id: ROUND_ID,
    state: "collecting",
    board_snapshot_before: createBoard(),
    started_at: new Date().toISOString(),
    frozen_tiles_before: opts.roundFrozenTilesBefore,
  };
  const submissionRows = [
    {
      id: "sub-1",
      player_id: PLAYER_A,
      from_x: 0,
      from_y: 0,
      to_x: 1,
      to_y: 0,
      submitted_at: "2026-06-09T12:00:00.000Z",
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
          })),
        };
      }
      if (table === "rounds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: roundData, error: null }),
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

// Spec 042 regression — the fast path must score against the round-start
// freeze baseline (rounds.frozen_tiles_before), mirroring the combined pass.
// Using matches.frozen_tiles makes a re-fired fast path reject its own swap
// once its previous run has merged the new freezes into the match row.
describe("instantScoreFirstSubmission — frozen-tile scoring baseline (spec 042)", () => {
  const PRIOR_ROUND_FREEZE = { "9,9": { owner: "player_b" } };
  const POLLUTED = {
    "9,9": { owner: "player_b" },
    "0,0": { owner: "player_a" },
    "1,0": { owner: "player_a" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [],
      finalBoard: createBoard(),
      newFrozenTiles: {},
    } as never);
  });

  it("passes rounds.frozen_tiles_before to the scoring pipeline", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({
        matchFrozenTiles: POLLUTED,
        roundFrozenTilesBefore: PRIOR_ROUND_FREEZE,
      }) as never,
    );

    await instantScoreFirstSubmission(MATCH_ID);

    expect(computeWordScoresForRound).toHaveBeenCalledOnce();
    const frozenTilesArg =
      vi.mocked(computeWordScoresForRound).mock.calls[0][7];
    expect(frozenTilesArg).toEqual(PRIOR_ROUND_FREEZE);
  });

  it("falls back to matches.frozen_tiles when frozen_tiles_before is null (legacy rounds)", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({
        matchFrozenTiles: PRIOR_ROUND_FREEZE,
        roundFrozenTilesBefore: null,
      }) as never,
    );

    await instantScoreFirstSubmission(MATCH_ID);

    const frozenTilesArg =
      vi.mocked(computeWordScoresForRound).mock.calls[0][7];
    expect(frozenTilesArg).toEqual(PRIOR_ROUND_FREEZE);
  });
});
