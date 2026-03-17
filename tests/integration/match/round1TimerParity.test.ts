/**
 * Integration test: Round 1 Timer Parity (US2)
 *
 * Verifies that when a player submits in round 1, their timer status is
 * "paused" in the MatchState — identical behaviour to rounds 2–10.
 *
 * Root cause of the bug: stateLoader created round 1 without `started_at`,
 * so `computeElapsedMs` could never fire and the timer always read "running".
 * Fix: stateLoader now sets `started_at: new Date().toISOString()` for round 1.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/scoring/roundSummary", () => ({
  aggregateRoundSummary: vi.fn().mockReturnValue(null),
}));
vi.mock("@/scripts/supabase/generateBoard", () => ({
  generateBoard: vi.fn().mockReturnValue(
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
  ),
}));

import { loadMatchState } from "@/lib/match/stateLoader";
import { getServiceRoleClient } from "@/lib/supabase/server";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const MATCH_ID = "match-round1-parity-test";

function makeBoard() {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
}

function makeMockClient(options: {
  roundStartedAt: string | null;
  playerASubmittedAt: string | null;
  playerBSubmittedAt: string | null;
}) {
  const submissions: Array<{ player_id: string; submitted_at: string }> = [];
  if (options.playerASubmittedAt) {
    submissions.push({ player_id: PLAYER_A, submitted_at: options.playerASubmittedAt });
  }
  if (options.playerBSubmittedAt) {
    submissions.push({ player_id: PLAYER_B, submitted_at: options.playerBSubmittedAt });
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 1,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 300_000,
                player_b_timer_ms: 300_000,
                frozen_tiles: {},
              },
              error: null,
            }),
          })),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
        };
      }
      if (table === "rounds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "round-1",
                state: "collecting",
                board_snapshot_before: makeBoard(),
                board_snapshot_after: null,
                started_at: options.roundStartedAt,
              },
              error: null,
            }),
          })),
          upsert: vi.fn().mockResolvedValue({}),
        };
      }
      if (table === "move_submissions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: submissions, error: null }),
        };
      }
      if (table === "scoreboard_snapshots") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
      };
    }),
  };
}

describe("Round 1 timer parity (US2)", () => {
  beforeEach(() => {
    vi.mocked(getServiceRoleClient).mockReset();
  });

  it("shows playerA timer as paused when playerA has submitted in round 1 (started_at set)", async () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const fiveSecondsAgo = new Date(Date.now() - 5_000).toISOString();

    const mockClient = makeMockClient({
      roundStartedAt: tenSecondsAgo,
      playerASubmittedAt: fiveSecondsAgo,
      playerBSubmittedAt: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    const state = await loadMatchState(mockClient as never, MATCH_ID);

    expect(state).not.toBeNull();
    // Player A submitted → timer should be paused
    expect(state!.timers.playerA.status).toBe("paused");
    // Player B has not submitted → timer should be running
    expect(state!.timers.playerB.status).toBe("running");
  });

  it("shows both timers as running when neither player has submitted in round 1", async () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();

    const mockClient = makeMockClient({
      roundStartedAt: tenSecondsAgo,
      playerASubmittedAt: null,
      playerBSubmittedAt: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    const state = await loadMatchState(mockClient as never, MATCH_ID);

    expect(state).not.toBeNull();
    expect(state!.timers.playerA.status).toBe("running");
    expect(state!.timers.playerB.status).toBe("running");
  });

  it("shows both timers as paused when both players have submitted in round 1", async () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const sevenSecondsAgo = new Date(Date.now() - 7_000).toISOString();
    const threeSecondsAgo = new Date(Date.now() - 3_000).toISOString();

    const mockClient = makeMockClient({
      roundStartedAt: tenSecondsAgo,
      playerASubmittedAt: sevenSecondsAgo,
      playerBSubmittedAt: threeSecondsAgo,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    const state = await loadMatchState(mockClient as never, MATCH_ID);

    expect(state).not.toBeNull();
    expect(state!.timers.playerA.status).toBe("paused");
    expect(state!.timers.playerB.status).toBe("paused");
  });
});
