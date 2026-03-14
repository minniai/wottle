import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/scoring/roundSummary", () => ({ aggregateRoundSummary: vi.fn().mockReturnValue(null) }));
vi.mock("@/scripts/supabase/generateBoard", () => ({
  generateBoard: vi.fn().mockReturnValue(
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
  ),
}));

import { loadMatchState } from "@/lib/match/stateLoader";
import { getServiceRoleClient } from "@/lib/supabase/server";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const MATCH_ID = "match-round1-timer-test";

describe("stateLoader — round 1 timer fix (US2)", () => {
  let upsertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(getServiceRoleClient).mockReset();
    upsertSpy = vi.fn().mockResolvedValue({});
  });

  it("creates round 1 with started_at set to a non-null ISO timestamp", async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "matches") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: MATCH_ID,
                  state: "pending",
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
                  board_snapshot_before: Array.from({ length: 10 }, () =>
                    Array.from({ length: 10 }, () => "A"),
                  ),
                  board_snapshot_after: null,
                  started_at: new Date().toISOString(),
                },
                error: null,
              }),
            })),
            upsert: upsertSpy,
          };
        }
        if (table === "move_submissions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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

    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    await loadMatchState(mockClient as never, MATCH_ID);

    // Verify the round 1 upsert was called with started_at set
    expect(upsertSpy).toHaveBeenCalledOnce();
    const upsertPayload = upsertSpy.mock.calls[0][0];
    expect(upsertPayload).toHaveProperty("started_at");
    expect(typeof upsertPayload.started_at).toBe("string");
    // Verify it's a valid ISO timestamp (not null/undefined)
    expect(new Date(upsertPayload.started_at).getTime()).not.toBeNaN();
  });
});
