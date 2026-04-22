/**
 * Integration test for the Phase 6 forced-winner path in completeMatchInternal.
 *
 * Disconnect flows (claim-win + 90s auto-finalise) award the still-connected /
 * claiming player regardless of current score. This guards against the earlier
 * behaviour where a disconnected leader would still win based on the scoreboard.
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
vi.mock("@/lib/rating/persistRatingChanges", () => ({
  persistRatingChanges: vi.fn().mockResolvedValue(undefined),
}));

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "match-forced-winner-test";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function setupMocks(scores: { playerA: number; playerB: number }) {
  let matchUpdatePayload: Record<string, unknown> | null = null;

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
        frozen_tiles: {},
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

  const playersSelectChain = {
    in: vi.fn().mockResolvedValue({
      data: [
        { id: PLAYER_A, elo_rating: 1200, games_played: 10 },
        { id: PLAYER_B, elo_rating: 1200, games_played: 10 },
      ],
      error: null,
    }),
  };

  const matchesUpdate = vi.fn().mockImplementation((payload: unknown) => {
    matchUpdatePayload = payload as Record<string, unknown>;
    return { eq: vi.fn().mockResolvedValue({ error: null }) };
  });

  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "matches")
        return { select: vi.fn(() => matchChain), update: matchesUpdate };
      if (table === "scoreboard_snapshots")
        return { select: vi.fn(() => scoreboardChain) };
      if (table === "players")
        return {
          select: vi.fn(() => playersSelectChain),
          update: vi
            .fn()
            .mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
        };
      if (table === "lobby_presence")
        return {
          update: vi
            .fn()
            .mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
        };
      if (table === "match_logs")
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    }),
  } as never);

  return { getMatchUpdatePayload: () => matchUpdatePayload };
}

describe("completeMatchInternal forcedWinnerId (Phase 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses forcedWinnerId over determineMatchWinner when the disconnected player is leading on score", async () => {
    // Player B has 30-10 lead, but A is claiming the win after B disconnected.
    const { getMatchUpdatePayload } = setupMocks({ playerA: 10, playerB: 30 });

    const result = await completeMatchInternal(MATCH_ID, "disconnect", PLAYER_A);

    expect(getMatchUpdatePayload()).toMatchObject({
      winner_id: PLAYER_A,
      ended_reason: "disconnect",
    });
    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.loserId).toBe(PLAYER_B);
    expect(result.isDraw).toBe(false);
  });

  it("falls back to determineMatchWinner when no forcedWinnerId is passed", async () => {
    // Score-based path: playerB leads → playerB wins.
    const { getMatchUpdatePayload } = setupMocks({ playerA: 10, playerB: 30 });

    const result = await completeMatchInternal(MATCH_ID, "round_limit");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: PLAYER_B });
    expect(result.winnerId).toBe(PLAYER_B);
  });
});
