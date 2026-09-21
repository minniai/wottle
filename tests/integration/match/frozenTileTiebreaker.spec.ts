/**
 * Frozen-tile tiebreaker (spec 050 FR-010, formerly T021-T022): when both
 * players have ten moves and equal scores, completeMatchInternal decides by
 * exclusively-owned frozen tiles; equal counts draw. Each tile has one owner.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/match/logWriter", () => ({
  writeMatchLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/observability/log", () => ({
  trackMatchResult: vi.fn(),
}));
vi.mock("@/lib/rating/persistRatingChanges", () => ({
  persistRatingChanges: vi.fn().mockResolvedValue(undefined),
}));

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "match-tiebreaker-test";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function setupMocks(
  frozenTiles: Record<string, { owner: string }>,
  scores = { playerA: 100, playerB: 100 },
) {
  let matchUpdatePayload: unknown = null;

  const matchChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: MATCH_ID,
        state: "in_progress",
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
        winner_id: null,
        ended_reason: null,
        move_limit: 10,
        frozen_tiles: frozenTiles,
        player_a_score: scores.playerA,
        player_b_score: scores.playerB,
        player_a_moves: 10,
        player_b_moves: 10,
      },
      error: null,
    }),
  };

  const playersSelectChain = {
    in: vi.fn().mockResolvedValue({
      data: [
        { id: PLAYER_A, elo_rating: 1200, games_played: 10 },
        { id: PLAYER_B, elo_rating: 1200, games_played: 10 },
      ],
      error: null,
    }),
  };

  // The completion compare-and-set: update().eq().in().select() → the flipped row.
  const matchesUpdate = vi.fn().mockImplementation((payload: unknown) => {
    matchUpdatePayload = payload;
    const select = vi.fn().mockResolvedValue({ data: [{ id: MATCH_ID }], error: null });
    return { eq: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ select }) }) };
  });

  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "matches")
        return { select: vi.fn(() => matchChain), update: matchesUpdate };
      if (table === "players")
        return {
          select: vi.fn(() => playersSelectChain),
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        };
      if (table === "lobby_presence")
        return { update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "match_logs")
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    }),
  } as never);

  return { getMatchUpdatePayload: () => matchUpdatePayload };
}

describe("frozenTileTiebreaker (spec 050 FR-010)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("equal scores + A has more exclusively-owned frozen tiles → A wins", async () => {
    const frozenTiles = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_a" },
      "2,2": { owner: "player_a" },
      "3,3": { owner: "player_b" },
    }; // playerA=3, playerB=1 (exclusive)

    const { getMatchUpdatePayload } = setupMocks(frozenTiles);

    const result = await completeMatchInternal(MATCH_ID, "natural");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: PLAYER_A, ended_reason: "moves_complete" });
    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.isDraw).toBe(false);
  });

  it("equal scores + equal frozen tiles → draw", async () => {
    const frozenTiles = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_b" },
    }; // playerA=1, playerB=1 (first-owner-wins, no shared tiles)

    const { getMatchUpdatePayload } = setupMocks(frozenTiles);

    const result = await completeMatchInternal(MATCH_ID, "natural");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: null, ended_reason: "moves_complete" });
    expect(result.isDraw).toBe(true);
  });
});
