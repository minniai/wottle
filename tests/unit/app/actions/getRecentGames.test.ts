import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { recentGameRowSchema } from "@/lib/types/lobby";

type QueryResult = { data: unknown; error: { message: string } | null };

function buildChain(result: QueryResult) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

const PLAYER_ID = "player-alpha";
const OPPONENT_ID = "player-beta";
const OPPONENT_USERNAME = "rg-beta";

const matchRows = [
  {
    id: "match-1",
    player_a_id: PLAYER_ID,
    player_b_id: OPPONENT_ID,
    winner_id: PLAYER_ID,
    completed_at: "2026-04-20T10:00:00.000Z",
    player_a: { id: PLAYER_ID, username: "rg-alpha", display_name: "Rg Alpha" },
    player_b: {
      id: OPPONENT_ID,
      username: OPPONENT_USERNAME,
      display_name: "Rg Beta",
    },
  },
  {
    id: "match-2",
    player_a_id: PLAYER_ID,
    player_b_id: OPPONENT_ID,
    winner_id: OPPONENT_ID,
    completed_at: "2026-04-20T09:00:00.000Z",
    player_a: { id: PLAYER_ID, username: "rg-alpha", display_name: "Rg Alpha" },
    player_b: {
      id: OPPONENT_ID,
      username: OPPONENT_USERNAME,
      display_name: "Rg Beta",
    },
  },
];

const snapshotRows = [
  { match_id: "match-1", round_number: 10, player_a_score: 120, player_b_score: 90 },
  { match_id: "match-2", round_number: 10, player_a_score: 70, player_b_score: 110 },
];

beforeEach(() => {
  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return buildChain({ data: matchRows, error: null });
      }
      if (table === "scoreboard_snapshots") {
        return buildChain({ data: snapshotRows, error: null });
      }
      return buildChain({ data: null, error: null });
    }),
  } as never);
});

describe("getRecentGames", () => {
  test("returns the current player's completed matches with opponent info", async () => {
    const result = await getRecentGames({ playerId: PLAYER_ID, limit: 10 });
    expect(result.games.length).toBe(2);
    const winRow = result.games.find((g) => g.result === "win");
    const lossRow = result.games.find((g) => g.result === "loss");
    expect(winRow?.opponentUsername).toBe(OPPONENT_USERNAME);
    expect(lossRow?.opponentUsername).toBe(OPPONENT_USERNAME);
    expect(winRow?.yourScore).toBe(120);
    expect(winRow?.opponentScore).toBe(90);
    expect(lossRow?.yourScore).toBe(70);
    expect(lossRow?.opponentScore).toBe(110);
  });

  test("rejects invalid limits", async () => {
    await expect(
      getRecentGames({ playerId: PLAYER_ID, limit: 0 }),
    ).rejects.toThrow();
  });

  test("each row validates against recentGameRowSchema", async () => {
    const result = await getRecentGames({ playerId: PLAYER_ID, limit: 10 });
    for (const row of result.games) {
      expect(() => recentGameRowSchema.parse(row)).not.toThrow();
    }
  });
});
