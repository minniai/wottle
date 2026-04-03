/**
 * Integration tests for match-end by round limit (US3, T012).
 * Verifies that completeMatchInternal with reason="round_limit" persists
 * ended_reason="round_limit" and the correct winner_id to the DB.
 * Also verifies advanceRound triggers completeMatchInternal on round 10.
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
vi.mock("@/app/actions/match/publishRoundSummary", () => ({
  publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
  computeWordScoresForRound: vi.fn().mockResolvedValue({ wordScores: [], finalBoard: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")) }),
}));

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { advanceRound } from "@/lib/match/roundEngine";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "match-roundlimit-test";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function setupCompleteMocks(scores: { playerA: number; playerB: number }) {
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

function setupAdvanceRoundMocks() {
  const matchChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: MATCH_ID,
        current_round: 10,
        state: "in_progress",
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
        board_seed: "seed-1",
        player_a_timer_ms: 300_000,
        player_b_timer_ms: 300_000,
        frozen_tiles: {},
      },
      error: null,
    }),
  };

  const roundChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "round-10",
        state: "collecting",
        board_snapshot_before: Array.from({ length: 10 }, () =>
          Array.from({ length: 10 }, () => "A"),
        ),
        started_at: new Date().toISOString(),
      },
      error: null,
    }),
  };

  let submissionsEqCount = 0;
  const submissionsChain = {
    eq: vi.fn().mockImplementation(() => {
      submissionsEqCount++;
      if (submissionsEqCount >= 2) {
        return Promise.resolve({
          data: [
            {
              id: "sub-a",
              player_id: PLAYER_A,
              from_x: 0,
              from_y: 0,
              to_x: 0,
              to_y: 1,
              submitted_at: new Date().toISOString(),
              status: "pending",
            },
            {
              id: "sub-b",
              player_id: PLAYER_B,
              from_x: 1,
              from_y: 0,
              to_x: 1,
              to_y: 1,
              submitted_at: new Date().toISOString(),
              status: "pending",
            },
          ],
          error: null,
        });
      }
      return submissionsChain;
    }),
  };

  const scoreboardChain = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  };

  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "matches")
        return {
          select: vi.fn(() => matchChain),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      if (table === "rounds")
        return {
          select: vi.fn(() => roundChain),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      if (table === "move_submissions")
        return {
          select: vi.fn(() => submissionsChain),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
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
}

describe("matchEndRoundLimit — completeMatchInternal (T012)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T012a: completeMatchInternal sets ended_reason='round_limit' in DB update", async () => {
    const { getMatchUpdatePayload } = setupCompleteMocks({ playerA: 80, playerB: 50 });

    await completeMatchInternal(MATCH_ID, "round_limit");

    expect(getMatchUpdatePayload()).toMatchObject({
      state: "completed",
      ended_reason: "round_limit",
    });
  });

  it("T012b: higher-score player wins when match ends by round limit", async () => {
    const { getMatchUpdatePayload } = setupCompleteMocks({ playerA: 80, playerB: 50 });

    const result = await completeMatchInternal(MATCH_ID, "round_limit");

    expect(getMatchUpdatePayload()).toMatchObject({ winner_id: PLAYER_A });
    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.endedReason).toBe("round_limit");
  });
});

describe("matchEndRoundLimit — advanceRound on round 10 (T012)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdvanceRoundMocks();
  });

  it("T012c: advanceRound on round 10 returns isGameOver=true", async () => {
    const result = await advanceRound(MATCH_ID);

    expect(result).toMatchObject({ status: "advanced", isGameOver: true });
  });
});
