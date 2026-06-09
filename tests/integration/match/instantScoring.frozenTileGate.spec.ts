/**
 * Spec 042 / US2 / T026 — frozen-tile gate sees fast-path freezes.
 *
 * After the instant-scoring fast path writes freezes to `matches.frozen_tiles`,
 * the second player's submitMove MUST be rejected by the existing frozen-tile
 * guard at `app/actions/match/submitMove.ts:117-136`.
 *
 * This is the cross-component contract that makes US2 work without any new
 * server code: the fast path persists via the same column the guard reads.
 *
 * We mock Supabase (no real DB) and exercise submitMove with a matches row
 * whose frozen_tiles already contains the target coordinate — the same shape
 * the fast path's executeScoringPipeline -> persistFrozenTilesAtomically
 * chain produces.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn((fn: () => void) => fn()) }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({
  assertWithinRateLimit: vi.fn(),
}));
vi.mock("@/lib/match/roundEngine", () => ({
  advanceRound: vi.fn().mockResolvedValue({ status: "waiting" }),
}));
vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/match/instantScoring", () => ({
  instantScoreFirstSubmission: vi
    .fn()
    .mockResolvedValue({ status: "deferred-to-combined", reason: "no-submissions" }),
}));

import { submitMove } from "@/app/actions/match/submitMove";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";

const PLAYER_A = "player-a-uuid";
const PLAYER_B = "player-b-uuid";
const MATCH_ID = "match-frozen-gate-test";
const ROUND_ID = "round-1";

function createBoard(): string[][] {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => "A"),
  );
}

/**
 * Build a Supabase mock that simulates the post-fast-path state:
 *   - `matches.frozen_tiles` contains `frozenCoords` (just-written by the fast path)
 *   - The round is still `collecting` (second player hasn't submitted yet)
 *   - No existing submission for the second player
 */
function makeMockWithFastPathFreezes(
  frozenCoords: Record<string, { owner: "player_a" | "player_b" }>,
) {
  const matchChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        current_round: 1,
        state: "in_progress",
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
        frozen_tiles: frozenCoords,
        player_a_timer_ms: 300_000,
        player_b_timer_ms: 300_000,
      },
      error: null,
    }),
  };

  const roundChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: ROUND_ID,
        state: "collecting",
        board_snapshot_before: createBoard(),
        started_at: new Date(Date.now() - 10_000).toISOString(),
      },
      error: null,
    }),
  };

  const existingSubmission = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const moveSubmissionInsert = vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "matches") return { select: vi.fn(() => matchChain) };
      if (table === "rounds") return { select: vi.fn(() => roundChain) };
      if (table === "move_submissions")
        return {
          select: vi.fn(() => existingSubmission),
          insert: moveSubmissionInsert,
        };
      return {};
    }),
  };
}

describe("Spec 042 US2 / T026 — submitMove guard sees fast-path freezes", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockResolvedValue({
      player: {
        id: PLAYER_B,
        username: "playerB",
        displayName: "Player B",
      },
    } as never);
  });

  it("rejects the second player's swap when the `from` tile was just frozen by the fast path", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithFastPathFreezes({
        "5,5": { owner: "player_a" },
      }) as never,
    );

    const result = await submitMove(MATCH_ID, 5, 5, 6, 5);

    expect(result).toMatchObject({
      status: "rejected",
      error: expect.stringMatching(/frozen/i),
    });
    if ("error" in result && result.error) {
      expect(result.error).toContain("(5,5)");
    }
  });

  it("rejects the second player's swap when the `to` tile was just frozen by the fast path", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithFastPathFreezes({
        "3,7": { owner: "player_a" },
      }) as never,
    );

    const result = await submitMove(MATCH_ID, 2, 7, 3, 7);

    expect(result).toMatchObject({
      status: "rejected",
      error: expect.stringMatching(/frozen/i),
    });
    if ("error" in result && result.error) {
      expect(result.error).toContain("(3,7)");
    }
  });

  it("rejects regardless of who owns the freeze (player_b's own freezes also block player_b)", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithFastPathFreezes({
        "1,1": { owner: "player_b" },
      }) as never,
    );

    const result = await submitMove(MATCH_ID, 1, 1, 2, 1);

    expect(result).toMatchObject({
      status: "rejected",
      error: expect.stringMatching(/frozen/i),
    });
  });

  it("accepts the swap when both swap coordinates are clear of fast-path freezes", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeMockWithFastPathFreezes({
        "5,5": { owner: "player_a" },
        "6,5": { owner: "player_a" },
      }) as never,
    );

    const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

    expect(result).toMatchObject({ status: "accepted" });
  });
});
