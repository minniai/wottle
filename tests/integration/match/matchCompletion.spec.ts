/**
 * Match completion (US1, spec 050): once a match is completed, a further move
 * is refused at receipt with "Match has ended" and nothing is recorded.
 *
 * Uses a mocked Supabase client; `receive_move` is the database's gate.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/moveResolver", () => ({ resolvePendingMoves: vi.fn() }));

import { submitMove } from "@/app/actions/match/submitMove";
import { resolvePendingMoves } from "@/lib/match/moveResolver";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";

const PLAYER_A = "11111111-1111-4111-8111-111111111111";
const MATCH_ID = "33333333-3333-4333-8333-333333333333";

describe("matchCompletion integration (T009, spec 050)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLobbySession).mockResolvedValue({
      player: { id: PLAYER_A, username: "playerA", displayName: "Player A" },
    } as never);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: { status: "rejected", reason: "ended" }, error: null }),
    } as never);
  });

  it("a move on a completed match is refused with 'Match has ended'", async () => {
    const result = await submitMove(MATCH_ID, { fromX: 1, fromY: 1, toX: 1, toY: 2, fromLetter: "A", toLetter: "B" });
    expect(result).toEqual({ status: "rejected", reason: "ended", error: "Match has ended" });
  });

  it("nothing is resolved after a refusal, whatever the coordinates", async () => {
    await submitMove(MATCH_ID, { fromX: 5, fromY: 5, toX: 5, toY: 6, fromLetter: "A", toLetter: "B" });
    expect(resolvePendingMoves).not.toHaveBeenCalled();
  });
});
