/**
 * Integration tests for frozen-tile tiebreaker (US4, T021-T022).
 * Verifies that when scores are equal, completeMatchInternal uses
 * exclusively-owned frozen tile counts to break the tie.
 * Each tile has exactly one owner (first-owner-wins).
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
  trackRoundCompleted: vi.fn(),
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
        round_limit: 10,
        frozen_tiles: frozenTiles,
      },
      error: null,
    }),
  };

  const scoreboardChain = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        round_number: 10,
        player_a_score: scores.playerA,
        player_b_score: scores.playerB,
      },
    }),
  };

  const matchesUpdate = vi.fn().mockImplementation((payload: unknown) => {
    matchUpdatePayload = payload;
    return { eq: vi.fn().mockResolvedValue({ error: null }) };
  });

  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "matches")
        return { select: vi.fn(() => matchChain), update: matchesUpdate };
      if (table === "scoreboard_snapshots")
        return { select: vi.fn(() => scoreboardChain) };
      if (table === "players")
        return { update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "lobby_presence")
        return { update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }) };
      if (table === "match_logs")
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    }),
  } as never);

  return { getMatchUpdatePayload: () => matchUpdatePayload };
}

describe("frozenTileTiebreaker (T021-T022)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T021: equal scores + A has more exclusively-owned frozen tiles → A wins", async () => {
    const frozenTiles = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_a" },
      "2,2": { owner: "player_a" },
      "3,3": { owner: "player_b" },
    }; // playerA=3, playerB=1 (exclusive)

    const { getMatchUpdatePayload } = setupMocks(frozenTiles);

    const result = await completeMatchInternal(MATCH_ID, "round_limit");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: PLAYER_A });
    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.isDraw).toBe(false);
  });

  it("T022: equal scores + equal frozen tiles → draw", async () => {
    const frozenTiles = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_b" },
    }; // playerA=1, playerB=1 (first-owner-wins, no shared tiles)

    const { getMatchUpdatePayload } = setupMocks(frozenTiles);

    const result = await completeMatchInternal(MATCH_ID, "round_limit");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: null });
    expect(result.isDraw).toBe(true);
  });
});
