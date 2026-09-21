import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/match/[matchId]/words/route";

vi.mock("@/lib/matchmaking/profile", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/matchmaking/profile");
  return { ...actual, readLobbySession: vi.fn() };
});
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/wordHistory", () => ({ loadMatchWordHistory: vi.fn() }));

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { loadMatchWordHistory } from "@/lib/match/wordHistory";

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const WORDS = [
  { moveSeq: 1, globalSeq: 1, playerId: "player-a", word: "borð", length: 4, lettersPoints: 9, bonusPoints: 10, totalPoints: 19, coordinates: [{ x: 4, y: 6 }], direction: "ltr" },
];

function mockMatch(row: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({ data: row, error: row ? null : { message: "not found" } });
  const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) })) };
  vi.mocked(getServiceRoleClient).mockReturnValue(client as never);
}

function request() {
  return new NextRequest(`http://localhost/api/match/${MATCH_ID}/words`);
}

describe("GET /api/match/[matchId]/words (spec 047 FR-003)", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: "player-a" } } as never);
    vi.mocked(loadMatchWordHistory).mockResolvedValue(WORDS as never);
    mockMatch({ player_a_id: "player-a", player_b_id: "player-b", state: "in_progress" });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    const res = await GET(request(), { params: Promise.resolve({ matchId: MATCH_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a match id that is not a uuid", async () => {
    const res = await GET(request(), { params: Promise.resolve({ matchId: "nope" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the match does not exist", async () => {
    mockMatch(null);
    const res = await GET(request(), { params: Promise.resolve({ matchId: MATCH_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 to a non-participant while the match is live", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: "stranger" } } as never);
    const res = await GET(request(), { params: Promise.resolve({ matchId: MATCH_ID }) });
    expect(res.status).toBe(403);
  });

  it("lets a non-participant read a completed match (read-only room)", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: "stranger" } } as never);
    mockMatch({ player_a_id: "player-a", player_b_id: "player-b", state: "completed" });
    const res = await GET(request(), { params: Promise.resolve({ matchId: MATCH_ID }) });
    expect(res.status).toBe(200);
    expect(loadMatchWordHistory).toHaveBeenCalledWith(expect.anything(), MATCH_ID);
  });

  it("returns the history for a participant with no-store caching", async () => {
    const res = await GET(request(), { params: Promise.resolve({ matchId: MATCH_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ matchId: MATCH_ID, words: WORDS });
    expect(loadMatchWordHistory).toHaveBeenCalledWith(expect.anything(), MATCH_ID);
  });
});
