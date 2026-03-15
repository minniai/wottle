/**
 * Integration tests for auto-pass synthesis (US2, T010).
 * Verifies that when a timed-out player has not submitted and the opponent submits,
 * advanceRound synthesizes a "timeout" submission and resolves the round.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/app/actions/match/publishRoundSummary", () => ({
  publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
  computeWordScoresForRound: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn().mockResolvedValue({}),
}));

import { advanceRound } from "@/lib/match/roundEngine";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "match-autopass-test";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const TEN_MIN_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

function createBoard() {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
}

describe("autoPass synthesis (T010)", () => {
  let insertedSubmissions: unknown[];
  let updateCalls: { table: string; payload: unknown }[];

  beforeEach(() => {
    insertedSubmissions = [];
    updateCalls = [];

    const matchChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: MATCH_ID,
          current_round: 1,
          state: "in_progress",
          player_a_id: PLAYER_A,
          player_b_id: PLAYER_B,
          board_seed: "seed-1",
          player_a_timer_ms: 3_600_000, // 60 min — not expired after 10-min elapsed round
          player_b_timer_ms: 0, // Player B has no time left
          frozen_tiles: {},
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
          started_at: TEN_MIN_AGO, // Started 10 minutes ago → Player B (0ms) is expired
        },
        error: null,
      }),
    };

    // Only Player A has submitted; Player B is absent and timed out
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
            ],
            error: null,
          });
        }
        return submissionsChain;
      }),
    };

    const mockInsert = vi.fn().mockImplementation((payload: unknown) => {
      insertedSubmissions.push(payload);
      return Promise.resolve({ error: null });
    });

    const scoreboardChain = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };

    const mockUpdate = vi.fn().mockImplementation((payload: unknown) => {
      updateCalls.push({ table: "?", payload });
      return { eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const matchesUpdate = vi.fn().mockImplementation((payload: unknown) => {
      updateCalls.push({ table: "matches", payload });
      return { eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const roundsUpdate = vi.fn().mockImplementation((payload: unknown) => {
      updateCalls.push({ table: "rounds", payload });
      return { eq: vi.fn().mockResolvedValue({ error: null }) };
    });

    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "matches") return { select: vi.fn(() => matchChain), update: matchesUpdate };
        if (table === "rounds") return { select: vi.fn(() => roundChain), update: roundsUpdate, insert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === "move_submissions") return { select: vi.fn(() => submissionsChain), insert: mockInsert, update: mockUpdate };
        if (table === "scoreboard_snapshots") return { select: vi.fn(() => scoreboardChain) };
        return {};
      }),
    } as never);
  });

  it("T010a: auto-resolves round when timed-out player is absent and opponent submits", async () => {
    const result = await advanceRound(MATCH_ID);

    // Round should advance (not return "waiting")
    expect(result).toMatchObject({ status: "advanced" });
  });

  it("T010b: inserts synthetic timeout submission for the absent timed-out player", async () => {
    await advanceRound(MATCH_ID);

    // A synthetic "timeout" submission should have been inserted for Player B
    const timeoutSub = insertedSubmissions.find(
      (s: any) => s.player_id === PLAYER_B && s.status === "timeout",
    );
    expect(timeoutSub).toBeDefined();
  });
});
