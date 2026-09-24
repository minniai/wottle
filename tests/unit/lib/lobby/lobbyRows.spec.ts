import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/presence/presenceService", () => ({
  playerPresence: vi.fn(async () => [
    { playerId: "me", state: "here", movesPlayed: null },
    { playerId: "kari", state: "here", movesPlayed: null },
    { playerId: "jonas", state: "in_match", movesPlayed: 6 },
  ]),
}));
vi.mock("@/lib/rating/playerRatings", () => ({ readEloRatings: vi.fn(async () => new Map([["kari", 1179]])) }));
vi.mock("@/lib/matchmaking/headToHead", () => ({ headToHead: vi.fn(async () => new Map([["kari", { wins: 3, losses: 1, draws: 0 }]])) }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        in: async () => ({ data: [{ id: "kari", username: "kári", display_name: "Kári" }, { id: "jonas", username: "jónas", display_name: "Jónas" }] }),
      }),
    }),
  }),
}));

import { lobbyRows } from "@/lib/lobby/lobbyRows";

/** Spec 070 US2 (T052): the lobby's rows for a viewer, never including themselves. */
describe("lobbyRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists everyone else with rating, state, moves and the viewer's record", async () => {
    const rows = await lobbyRows("me", "is");
    expect(rows).toEqual([
      { playerId: "kari", displayName: "Kári", handle: "kári", rating: 1179, state: "here", movesPlayed: null, record: { wins: 3, losses: 1, draws: 0 } },
      { playerId: "jonas", displayName: "Jónas", handle: "jónas", rating: 1200, state: "in_match", movesPlayed: 6, record: null },
    ]);
  });
});
