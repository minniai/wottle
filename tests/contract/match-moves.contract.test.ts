/**
 * Spec 071 (T005, contracts/routes-and-actions.md): the public moves of a completed match.
 * Needs no session; a live, pending, void or unknown match reads the same 404.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/match/[matchId]/moves/route";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/review/movesRepository", () => ({ loadCompletedMoves: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));

import { loadCompletedMoves } from "@/lib/review/movesRepository";
import { readLobbySession } from "@/lib/matchmaking/profile";

import { bothFinished } from "../unit/lib/review/reviewFixtures";

const MATCH_ID = "11111111-1111-4111-8111-111111111111";

function call(matchId = MATCH_ID) {
  return GET(new NextRequest(`http://localhost/api/match/${matchId}/moves`), { params: Promise.resolve({ matchId }) });
}

describe("GET /api/match/[matchId]/moves (spec 071 FR-043)", () => {
  beforeEach(() => {
    vi.mocked(loadCompletedMoves).mockResolvedValue(bothFinished());
  });
  afterEach(() => vi.clearAllMocks());

  it("serves a completed match to a signed-out visitor, and never reads a session", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.moves).toHaveLength(20);
    expect(body.players.a.displayName).toBe("Birna");
    expect(readLobbySession).not.toHaveBeenCalled();
    expect(loadCompletedMoves).toHaveBeenCalledWith(expect.anything(), MATCH_ID);
  });

  it("caches a completed match for good, since it never changes", async () => {
    const res = await call();
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("answers a live, pending, void or unknown match with the same 404", async () => {
    vi.mocked(loadCompletedMoves).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a match id that is not a uuid", async () => {
    const res = await call("nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_id" });
    expect(loadCompletedMoves).not.toHaveBeenCalled();
  });
});
