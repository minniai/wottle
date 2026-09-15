import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/scoring/roundSummary", () => ({ aggregateRoundSummary: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/game-engine/boardGenerator", () => ({
  generateBoard: vi.fn().mockReturnValue(Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"))),
}));

import { loadMatchState } from "@/lib/match/stateLoader";

const MATCH_ID = "match-rated-fallback";
const ROW = {
  id: MATCH_ID,
  state: "pending",
  current_round: 1,
  board_seed: "seed-1",
  player_a_id: "player-a",
  player_b_id: "player-b",
  player_a_timer_ms: 300_000,
  player_b_timer_ms: 300_000,
  frozen_tiles: {},
  winner_id: null,
  created_at: "2026-09-15T10:00:00.000Z",
};

/** Records every `select(...)` string the loader asks the matches table for. */
function clientThatLacksRated(selects: string[]) {
  return {
    from: (table: string) => {
      if (table === "matches") {
        return {
          select: (columns: string) => {
            selects.push(columns);
            const missing = columns.includes("rated");
            return {
              eq: () => ({
                maybeSingle: async () =>
                  missing
                    ? { data: null, error: { code: "42703", message: "column matches.rated does not exist" } }
                    : { data: ROW, error: null },
              }),
            };
          },
          upsert: () => ({ select: () => ({ single: async () => ({ data: { id: MATCH_ID }, error: null }) }) }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
            order: () => ({ limit: async () => ({ data: [], error: null }) }),
            in: async () => ({ data: [], error: null }),
          }),
        }),
        upsert: async () => ({ data: null, error: null }),
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: "r1" }, error: null }) }) }),
      };
    },
  } as never;
}

/**
 * A deploy can reach an environment whose migration has not run. Before this,
 * the loader asked for `matches.rated`, Postgres answered 42703, loadMatchState
 * returned null, and the match page redirected to a lobby that redirected
 * straight back — every match in production became an endless loop
 * (Vercel, 2026-09-15).
 */
describe("stateLoader — matches.rated may not exist yet (spec 045)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the match anyway, retrying without the column", async () => {
    const selects: string[] = [];
    const state = await loadMatchState(clientThatLacksRated(selects), MATCH_ID);

    expect(state, "a missing caption column must not fail the whole match").not.toBeNull();
    expect(state?.matchId).toBe(MATCH_ID);
    // Asked with it first, then once without.
    expect(selects.filter((s) => s.includes("rated"))).toHaveLength(1);
    expect(selects.filter((s) => !s.includes("rated"))).toHaveLength(1);
  });

  it("treats the match as rated, which is the column's own default", async () => {
    const state = await loadMatchState(clientThatLacksRated([]), MATCH_ID);
    expect(state?.rated).toBe(true);
  });
});
