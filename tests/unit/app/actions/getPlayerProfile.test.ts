import { beforeEach, describe, expect, test, vi } from "vitest";

// Spec 060: the profile reads its rating and record per language; here they are PLAYER_ROW's.
vi.mock("@/lib/rating/playerRatings", () => ({
  readRatings: vi.fn(async (_c: unknown, ids: string[]) =>
    new Map(ids.map((id) => [id, { eloRating: 1234, gamesPlayed: 7, wins: 4, losses: 2, draws: 1 }])),
  ),
}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));

import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import { readRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";

type QueryResult = { data: unknown; error: { message: string } | null };

function buildChain(result: QueryResult) {
  const chain = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  chain.select.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue(result);
  return chain;
}

const PLAYER_ROW = {
  id: "p1",
  username: "ari",
  display_name: "Ari",
  avatar_url: null,
  status: "available",
  last_seen_at: "2026-04-22T10:00:00Z",
  created_at: "2025-03-10T08:00:00Z",
  elo_rating: 1234,
  games_played: 7,
  wins: 4,
  losses: 2,
  draws: 1,
};

const VALID_PLAYER_ID = "00000000-0000-0000-0000-000000000001";

/** Build a supabase mock that dispatches per-table and tracks call index for
 *  `match_ratings` (which is queried 3 times in different shapes). */
function buildSupabase(overrides: {
  playerData?: unknown;
  playerError?: { message: string } | null;
  trendRows?: unknown;
  ratingHistoryRows?: unknown;
  formRows?: unknown;
  bestWordRows?: unknown;
}) {
  const {
    playerData = PLAYER_ROW,
    playerError = null,
    trendRows = [],
    ratingHistoryRows = [],
    formRows = [],
    bestWordRows = [],
  } = overrides;

  let matchRatingsCallCount = 0;
  const matchRatingsData = [trendRows, ratingHistoryRows, formRows];

  return {
    from: vi.fn((table: string) => {
      if (table === "players") {
        return buildChain({ data: playerData, error: playerError });
      }
      if (table === "match_ratings") {
        const data = matchRatingsData[matchRatingsCallCount] ?? [];
        matchRatingsCallCount++;
        return buildChain({ data, error: null });
      }
      if (table === "word_score_entries") {
        return buildChain({ data: bestWordRows, error: null });
      }
      return buildChain({ data: null, error: null });
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServiceRoleClient).mockReturnValue(
    buildSupabase({}) as never,
  );
});

describe("getPlayerProfile", () => {
  test("returns not_found when the player row does not exist", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({
        playerData: null,
        playerError: { message: "no row" },
      }) as never,
    );

    const result = await getPlayerProfile(VALID_PLAYER_ID);

    expect(result.status).toBe("not_found");
  });

  test("returns error when playerId is not a UUID", async () => {
    const result = await getPlayerProfile("not-a-uuid");

    expect(result.status).toBe("error");
  });

  test("returns peakRating as the max of rating history and current elo", async () => {
    const ratingHistoryRows = [
      { rating_after: 1180, created_at: "2026-04-01T00:00:00Z" },
      { rating_after: 1210, created_at: "2026-04-02T00:00:00Z" },
      { rating_after: 1190, created_at: "2026-04-03T00:00:00Z" },
    ];
    vi.mocked(readRatings).mockResolvedValueOnce(
      new Map([[VALID_PLAYER_ID, { eloRating: 1205, gamesPlayed: 7, wins: 4, losses: 2, draws: 1 }]]),
    );
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({
        playerData: PLAYER_ROW,
        ratingHistoryRows,
      }) as never,
    );

    const result = await getPlayerProfile(VALID_PLAYER_ID);

    expect(result.status).toBe("ok");
    expect(result.profile?.peakRating).toBe(1210);
  });

  test("returns peakRating = current elo when match_ratings is empty", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({
        playerData: { ...PLAYER_ROW, elo_rating: 1234 },
        ratingHistoryRows: [],
      }) as never,
    );

    const result = await getPlayerProfile(VALID_PLAYER_ID);

    expect(result.status).toBe("ok");
    expect(result.profile?.peakRating).toBe(1234);
  });

  test("returns form as last 10 results mapped to W/L/D (newest first)", async () => {
    const formRows = [
      { match_result: "win", created_at: "2026-04-04T00:00:00Z" },
      { match_result: "draw", created_at: "2026-04-03T00:00:00Z" },
      { match_result: "loss", created_at: "2026-04-02T00:00:00Z" },
      { match_result: "win", created_at: "2026-04-01T00:00:00Z" },
    ];
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({ formRows }) as never,
    );

    const result = await getPlayerProfile(VALID_PLAYER_ID);

    expect(result.status).toBe("ok");
    expect(result.profile?.form).toEqual(["W", "D", "L", "W"]);
  });

  test("returns bestWord when word_score_entries has at least one row", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({
        bestWordRows: [{ word: "KAFFI", total_points: 42 }],
      }) as never,
    );

    const result = await getPlayerProfile(VALID_PLAYER_ID);

    expect(result.status).toBe("ok");
    expect(result.profile?.bestWord).toEqual({ word: "KAFFI", points: 42 });
  });

  test("returns bestWord=null when the player has no word_score_entries", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({ bestWordRows: [] }) as never,
    );

    const result = await getPlayerProfile(VALID_PLAYER_ID);

    expect(result.status).toBe("ok");
    expect(result.profile?.bestWord).toBeNull();
  });

  test("returns the default rating and an empty record for a player with no matches", async () => {
    vi.mocked(readRatings).mockResolvedValueOnce(
      new Map([[VALID_PLAYER_ID, { eloRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 }]]),
    );

    const result = await getPlayerProfile(VALID_PLAYER_ID);

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        stats: {
          eloRating: 1200,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: null,
        },
        peakRating: 1200,
        bestWord: null,
        form: [],
        ratingHistory: [],
      },
    });
  });
});
