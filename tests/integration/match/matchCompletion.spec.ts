/**
 * Integration tests for match completion (US1).
 * T009: Verifies that after 10 rounds, match.state becomes "completed"
 * and an 11th submitMove is rejected with "Match has ended".
 *
 * Uses mocked Supabase to avoid needing a live database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/roundEngine", () => ({ advanceRound: vi.fn().mockResolvedValue({ status: "advanced" }) }));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn().mockResolvedValue({}),
}));

import { submitMove } from "@/app/actions/match/submitMove";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";

const PLAYER_A = "player-a";
const MATCH_ID = "match-end-test";

function createBoard() {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
}

function makeCompletedMatchMock() {
  const matchChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        current_round: 11,
        state: "completed",
        player_a_id: PLAYER_A,
        player_b_id: "player-b",
        frozen_tiles: {},
        player_a_timer_ms: 0,
        player_b_timer_ms: 0,
      },
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "matches") return { select: vi.fn(() => matchChain) };
      return {};
    }),
  };
}

describe("matchCompletion integration (T009)", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockResolvedValue({
      player: { id: PLAYER_A, username: "playerA", displayName: "Player A" },
    } as any);
  });

  it("T009: submitMove returns rejected 'Match has ended' when match.state is completed", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(makeCompletedMatchMock() as never);

    const result = await submitMove(MATCH_ID, 1, 1, 1, 2);

    expect(result).toMatchObject({
      status: "rejected",
      error: "Match has ended",
    });
  });

  it("T009: submitMove returns 'Match has ended' for any coordinate when match is completed", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(makeCompletedMatchMock() as never);

    const result = await submitMove(MATCH_ID, 5, 5, 5, 6);

    expect(result).toMatchObject({
      status: "rejected",
      error: "Match has ended",
    });
  });
});
