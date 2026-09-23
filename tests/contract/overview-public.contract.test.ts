/**
 * Spec 070 T021, FR-040: the lobby overview, read signed out, carries counts
 * and at most eight names with ratings and presence words, and nothing that
 * identifies a player or any one player's matches.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn(async () => null) }));
const presence = vi.hoisted(() => ({ rows: [] as Array<{ playerId: string; state: string; movesPlayed: number | null }> }));
vi.mock("@/lib/presence/presenceService", () => ({
  lobbyNumbers: vi.fn(async (language: string) => ({ here: language === "is" ? 12 : 4, searching: 1, playersInMatch: 2, matchesOn: 1 })),
  playerPresence: vi.fn(async () => presence.rows),
}));
vi.mock("@/lib/rating/playerRatings", () => ({
  readEloRatings: vi.fn(async (_c: unknown, ids: string[]) => new Map(ids.map((id, i) => [id, 1200 + i * 10]))),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: () => ({
    from: () => ({ select: () => ({ in: async (_col: string, ids: string[]) => ({ data: ids.map((id) => ({ id, display_name: `N-${id.slice(0, 4)}` })) }) }) }),
  }),
}));

import { GET } from "@/app/api/lobby/overview/route";

const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

describe("GET /api/lobby/overview, signed out (FR-040)", () => {
  beforeEach(() => {
    presence.rows = Array.from({ length: 11 }, (_, i) => ({ playerId: id(i), state: i === 0 ? "searching" : i === 10 ? "in_match" : "here", movesPlayed: null }));
  });

  it("returns the counts for this lobby and the other, at most eight names and the rest as a number", async () => {
    const res = await GET(new Request("http://localhost/api/lobby/overview?language=en"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts).toEqual({ here: 4, searching: 1, playersInMatch: 2, matchesOn: 1, other: { language: "is", here: 12 } });
    expect(body.here).toHaveLength(8);
    expect(body.more).toBe(2);
    expect(body.here.every((r: { state: string }) => r.state === "here")).toBe(true);
  });

  it("never carries a player id, a last match or a form", async () => {
    const body = await (await GET(new Request("http://localhost/api/lobby/overview?language=is"))).json();
    expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(body).not.toHaveProperty("lastMatch");
    expect(body).not.toHaveProperty("form");
    for (const row of body.here) expect(Object.keys(row).sort()).toEqual(["displayName", "rating", "state"]);
  });

  it("refuses a language it does not serve", async () => {
    expect((await GET(new Request("http://localhost/api/lobby/overview?language=dk"))).status).toBe(400);
  });
});
