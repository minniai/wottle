/**
 * The forced-winner path in completeMatchInternal (spec 050).
 *
 * A resignation or a claim names the winner whatever the totals. Without a
 * forced winner the rules decide: a `natural` end takes its reason from the
 * decision; a forced reason without a named winner keeps its reason.
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

const MATCH_ID = "match-forced-winner-test";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

interface Totals {
  scores: { playerA: number; playerB: number };
  moves?: { playerA: number; playerB: number };
}

function setupMocks({ scores, moves = { playerA: 10, playerB: 10 } }: Totals) {
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
        move_limit: 10,
        frozen_tiles: {},
        player_a_score: scores.playerA,
        player_b_score: scores.playerB,
        player_a_moves: moves.playerA,
        player_b_moves: moves.playerB,
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
    matchUpdatePayload = payload as Record<string, unknown>;
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

describe("completeMatchInternal forcedWinnerId (spec 050)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses forcedWinnerId over the rules when the disconnected player is leading on score", async () => {
    // Player B has 30-10 lead, but A ends the match after B disconnected.
    const { getMatchUpdatePayload } = setupMocks({ scores: { playerA: 10, playerB: 30 } });

    const result = await completeMatchInternal(MATCH_ID, "disconnect", PLAYER_A);

    expect(getMatchUpdatePayload()).toMatchObject({
      winner_id: PLAYER_A,
      ended_reason: "disconnect",
    });
    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.loserId).toBe(PLAYER_B);
    expect(result.isDraw).toBe(false);
  });

  it("falls back to the rules when no forcedWinnerId is passed: score decides once both have ten", async () => {
    const { getMatchUpdatePayload } = setupMocks({ scores: { playerA: 10, playerB: 30 } });

    const result = await completeMatchInternal(MATCH_ID, "natural");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: PLAYER_B, ended_reason: "moves_complete" });
    expect(result.winnerId).toBe(PLAYER_B);
  });

  it("a natural end with one player short of ten is an incomplete loss whatever the score", async () => {
    const { getMatchUpdatePayload } = setupMocks({
      scores: { playerA: 10, playerB: 30 },
      moves: { playerA: 10, playerB: 8 },
    });

    const result = await completeMatchInternal(MATCH_ID, "natural");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: PLAYER_A, ended_reason: "incomplete" });
    expect(result.endedReason).toBe("incomplete");
  });
});
