import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));

import { getTopPlayers } from "@/app/actions/player/getTopPlayers";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { topPlayerRowSchema } from "@/lib/types/lobby";

type QueryResult = { data: unknown; error: { message: string } | null };

function buildChain(result: QueryResult) {
  const chain = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  chain.select.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

const playerRows = [
  {
    id: "p-alpha",
    username: "tp-alpha",
    display_name: "Tp Alpha",
    elo_rating: 2000,
    avatar_url: null,
  },
  {
    id: "p-beta",
    username: "tp-beta",
    display_name: "Tp Beta",
    elo_rating: 1800,
    avatar_url: null,
  },
  {
    id: "p-gamma",
    username: "tp-gamma",
    display_name: "Tp Gamma",
    elo_rating: 1600,
    avatar_url: null,
  },
];

let playersChain: ReturnType<typeof buildChain>;

beforeEach(() => {
  playersChain = buildChain({ data: playerRows, error: null });
  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "players") return playersChain;
      return buildChain({ data: null, error: null });
    }),
  } as never);
});

describe("getTopPlayers", () => {
  test("returns players ordered by elo rating descending", async () => {
    const result = await getTopPlayers({ limit: 6 });
    expect(result.players.length).toBeGreaterThan(0);
    for (let i = 0; i < result.players.length - 1; i++) {
      expect(result.players[i].eloRating).toBeGreaterThanOrEqual(
        result.players[i + 1].eloRating,
      );
    }
  });

  test("passes the limit argument through to the query builder", async () => {
    await getTopPlayers({ limit: 2 });
    expect(playersChain.limit).toHaveBeenCalledWith(2);
  });

  test("rejects invalid limit values", async () => {
    await expect(getTopPlayers({ limit: 0 })).rejects.toThrow();
    await expect(getTopPlayers({ limit: 101 })).rejects.toThrow();
  });

  test("each row validates against topPlayerRowSchema", async () => {
    const result = await getTopPlayers({ limit: 6 });
    for (const row of result.players) {
      expect(() => topPlayerRowSchema.parse(row)).not.toThrow();
    }
  });
});
