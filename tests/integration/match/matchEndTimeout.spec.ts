/**
 * Integration tests for match-end by timeout (US3, T011).
 * Verifies that completeMatchInternal with reason="timeout" persists
 * ended_reason="timeout" and the correct winner_id to the DB.
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

const MATCH_ID = "match-timeout-test";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function setupMocks(scores: { playerA: number; playerB: number }) {
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
        round_number: 5,
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

describe("matchEndTimeout (T011)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T011a: completeMatchInternal sets ended_reason='timeout' in DB update", async () => {
    const { getMatchUpdatePayload } = setupMocks({ playerA: 100, playerB: 60 });

    await completeMatchInternal(MATCH_ID, "timeout");

    expect(getMatchUpdatePayload()).toMatchObject({
      state: "completed",
      ended_reason: "timeout",
    });
  });

  it("T011b: higher-score player wins when match ends by timeout", async () => {
    const { getMatchUpdatePayload } = setupMocks({ playerA: 100, playerB: 60 });

    const result = await completeMatchInternal(MATCH_ID, "timeout");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: PLAYER_A });
    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.endedReason).toBe("timeout");
  });

  it("T011c: winner_id is null (draw) when both players have equal scores at timeout", async () => {
    const { getMatchUpdatePayload } = setupMocks({ playerA: 50, playerB: 50 });

    const result = await completeMatchInternal(MATCH_ID, "timeout");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: null });
    expect(result.isDraw).toBe(true);
  });
});
