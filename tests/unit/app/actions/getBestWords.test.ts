import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn().mockResolvedValue({
    token: "tok",
    issuedAt: Date.now(),
    player: {
      id: "viewer",
      username: "viewer",
      displayName: "Viewer",
      status: "available",
      lastSeenAt: new Date().toISOString(),
      eloRating: 1200,
      avatarUrl: null,
    },
  }),
}));

import { getBestWords } from "@/app/actions/player/getBestWords";
import { getServiceRoleClient } from "@/lib/supabase/server";

type Row = { word: string; total_points: number };

function buildChain(rows: Row[]) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn(() => buildChain([])),
  } as never);
});

const VALID_PLAYER_ID = "00000000-0000-0000-0000-000000000001";

describe("getBestWords", () => {
  test("returns empty list when player has no scored words", async () => {
    const result = await getBestWords(VALID_PLAYER_ID);
    expect(result).toEqual({ status: "ok", words: [] });
  });

  test("dedupes by word keeping the highest-points row", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() =>
        buildChain([
          { word: "KAFFI", total_points: 42 },
          { word: "BRAUÐ", total_points: 31 },
          { word: "KAFFI", total_points: 20 },
          { word: "SMJÖR", total_points: 28 },
        ]),
      ),
    } as never);
    const result = await getBestWords(VALID_PLAYER_ID, 10);
    expect(result.status).toBe("ok");
    expect(result.words).toEqual([
      { word: "KAFFI", points: 42 },
      { word: "BRAUÐ", points: 31 },
      { word: "SMJÖR", points: 28 },
    ]);
  });

  test("honours the limit parameter", async () => {
    const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
      word: `WORD${i}`,
      total_points: 20 - i,
    }));
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() => buildChain(rows)),
    } as never);
    const result = await getBestWords(VALID_PLAYER_ID, 5);
    expect(result.words).toHaveLength(5);
    expect(result.words?.[0]).toEqual({ word: "WORD0", points: 20 });
  });

  test("returns error when playerId is not a UUID", async () => {
    const result = await getBestWords("not-a-uuid");
    expect(result.status).toBe("error");
  });
});
