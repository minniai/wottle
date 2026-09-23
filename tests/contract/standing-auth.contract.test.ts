/**
 * Spec 070 T079: GET /api/standing needs a session, and answers a StandingFacts
 * that parses, for that viewer.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ current: null as null | { player: { id: string } } }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn(async () => session.current) }));
vi.mock("@/lib/matchmaking/attention", () => ({ attentionFromQuery: () => null, recordAttention: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: () => ({}) }));
const facts = {
  now: new Date().toISOString(), topic: "player:abc", lobbyLanguage: "is", incoming: [], outgoing: null, cooldowns: [],
  search: null, tableCooldownUntil: null, match: null, switchPending: null, notice: null, counts: { here: 0, searching: 0, playing: 0, otherHere: 0 }, viewer: { rating: 1200, gamesPlayed: 0 },
};
vi.mock("@/lib/standing/readStanding", () => ({ readStanding: vi.fn(async () => facts) }));

import { GET } from "@/app/api/standing/route";
import { readStanding } from "@/lib/standing/readStanding";
import { standingFactsSchema } from "@/lib/types/standing";

describe("GET /api/standing", () => {
  it("is 401 without a session", async () => {
    session.current = null;
    expect((await GET(new Request("http://localhost/api/standing"))).status).toBe(401);
  });

  it("answers the viewer's standing facts", async () => {
    session.current = { player: { id: "p1" } };
    const res = await GET(new Request("http://localhost/api/standing?visible=1&inputAgoMs=10"));
    expect(res.status).toBe(200);
    expect(standingFactsSchema.safeParse(await res.json()).success).toBe(true);
    expect(readStanding).toHaveBeenCalledWith("p1");
  });
});
