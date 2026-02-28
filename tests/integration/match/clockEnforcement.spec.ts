/**
 * Integration tests for server-authoritative clock enforcement (US2).
 * T026: Verifies that submitMove rejects moves when a player's clock has expired
 * and triggers time_expiry completion when both clocks are expired.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/roundEngine", () => ({ advanceRound: vi.fn().mockResolvedValue({ status: "waiting" }) }));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn().mockResolvedValue({}),
}));

import { submitMove } from "@/app/actions/match/submitMove";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { advanceRound } from "@/lib/match/roundEngine";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const MATCH_ID = "match-clock-test";

function createBoard() {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
}

function makeMockWithExpiredClocks(playerATimerMs: number, playerBTimerMs: number, startedAgo: number) {
  const startedAt = new Date(Date.now() - startedAgo).toISOString();
  const matchChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        current_round: 1,
        state: "in_progress",
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
        frozen_tiles: {},
        player_a_timer_ms: playerATimerMs,
        player_b_timer_ms: playerBTimerMs,
      },
      error: null,
    }),
  };
  const roundChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "round-1",
        state: "collecting",
        board_snapshot_before: createBoard(),
        started_at: startedAt,
      },
      error: null,
    }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "matches") return { select: vi.fn(() => matchChain) };
      if (table === "rounds") return { select: vi.fn(() => roundChain) };
      return {};
    }),
  };
}

describe("clockEnforcement integration (T026)", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockResolvedValue({
      player: { id: PLAYER_A, username: "playerA", displayName: "Player A" },
    } as any);
  });

  it("T026: rejects move submission when current player clock is expired", async () => {
    // Player A had 60s, round started 5 minutes ago → expired
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithExpiredClocks(60_000, 300_000, 5 * 60 * 1000) as never,
    );

    const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

    expect(result).toMatchObject({
      status: "rejected",
      error: "Your time has expired",
    });
  });

  it("T026: accepts move when clock has remaining time", async () => {
    // Round started 10s ago, player has 60s → 50s remaining
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithExpiredClocks(60_000, 300_000, 10_000) as never,
    );

    // Also need to set up insert mock for move_submissions
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const existingSub = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const matchChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          current_round: 1,
          state: "in_progress",
          player_a_id: PLAYER_A,
          player_b_id: PLAYER_B,
          frozen_tiles: {},
          player_a_timer_ms: 60_000,
          player_b_timer_ms: 300_000,
        },
        error: null,
      }),
    };
    const startedAt = new Date(Date.now() - 10_000).toISOString();
    const roundChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "round-1",
          state: "collecting",
          board_snapshot_before: createBoard(),
          started_at: startedAt,
        },
        error: null,
      }),
    };

    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "matches") return { select: vi.fn(() => matchChain) };
        if (table === "rounds") return { select: vi.fn(() => roundChain) };
        if (table === "move_submissions") {
          return { select: vi.fn(() => existingSub), insert: mockInsert };
        }
        return {};
      }),
    } as never);

    const result = await submitMove(MATCH_ID, 1, 1, 1, 2);

    expect(result).toMatchObject({ status: "accepted" });
  });

  it("T026: triggers round advancement when current player's clock is expired", async () => {
    vi.mocked(advanceRound).mockClear();

    // Player A had 60s, round started 5 minutes ago → expired
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithExpiredClocks(60_000, 300_000, 5 * 60 * 1000) as never,
    );

    await submitMove(MATCH_ID, 0, 0, 0, 1);

    // advanceRound is triggered so the server can synthesize a timeout pass
    // or complete the match if both players are flagged.
    expect(advanceRound).toHaveBeenCalledWith(MATCH_ID);
  });

  it("T026b: triggers round advancement when both clocks are expired", async () => {
    vi.mocked(advanceRound).mockClear();

    // Both players had 60s, round started 5 minutes ago → both expired
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithExpiredClocks(60_000, 60_000, 5 * 60 * 1000) as never,
    );

    await submitMove(MATCH_ID, 0, 0, 0, 1);

    expect(advanceRound).toHaveBeenCalledWith(MATCH_ID);
  });
});
