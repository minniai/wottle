import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
}));
vi.mock("@/lib/rate-limiting/middleware", () => ({
  assertWithinRateLimit: vi.fn(),
}));
vi.mock("@/lib/match/logWriter", () => ({
  writeMatchLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/observability/log", () => ({
  trackMatchResult: vi.fn(),
}));

import { resignMatch } from "@/app/actions/match/resignMatch";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const MATCH_ID = "match-1";

function mockSession(playerId: string) {
  vi.mocked(readLobbySession).mockResolvedValue({
    player: { id: playerId, username: "test", displayName: "Test" },
  } as any);
}

function makeSupabaseMock(
  matchData: Record<string, unknown> | null,
  matchError: { message: string } | null = null,
) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: matchData,
      error: matchError,
    }),
  };

  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    })),
  };
}

describe("resignMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when not authenticated", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    await expect(resignMatch(MATCH_ID)).rejects.toThrow(
      "Authentication required.",
    );
  });

  it("throws when player is not a participant", async () => {
    mockSession("outsider");
    const mock = makeSupabaseMock({
      id: MATCH_ID,
      state: "in_progress",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
      winner_id: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as any);

    await expect(resignMatch(MATCH_ID)).rejects.toThrow(
      "You are not a participant in this match.",
    );
  });

  it("throws when match has already ended", async () => {
    mockSession(PLAYER_A);
    const mock = makeSupabaseMock({
      id: MATCH_ID,
      state: "completed",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
      winner_id: PLAYER_B,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as any);

    await expect(resignMatch(MATCH_ID)).rejects.toThrow(
      "Match has already ended.",
    );
  });

  it("refuses a match still at the table, and during the count (spec 069 FR-019)", async () => {
    mockSession(PLAYER_A);
    for (const row of [
      { state: "pending", started_at: null },
      { state: "in_progress", started_at: new Date(Date.now() + 3_000).toISOString() },
    ]) {
      const mock = makeSupabaseMock({ id: MATCH_ID, player_a_id: PLAYER_A, player_b_id: PLAYER_B, winner_id: null, ...row });
      vi.mocked(getServiceRoleClient).mockReturnValue(mock as any);
      await expect(resignMatch(MATCH_ID)).rejects.toThrow("The match has not started.");
    }
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  it("resigns successfully and declares opponent as winner", async () => {
    mockSession(PLAYER_A);
    const mock = makeSupabaseMock({
      id: MATCH_ID,
      state: "in_progress",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
      winner_id: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as any);

    const result = await resignMatch(MATCH_ID);

    expect(result).toEqual({
      matchId: MATCH_ID,
      winnerId: PLAYER_B,
      resigned: true,
    });
    // Spec 048: resignations must use the same rating persistence as every
    // other completed match, before publishing its final state.
    expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "forfeit", PLAYER_B);
  });

  it("declares player A as winner when player B resigns", async () => {
    mockSession(PLAYER_B);
    const mock = makeSupabaseMock({
      id: MATCH_ID,
      state: "in_progress",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
      winner_id: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as any);

    const result = await resignMatch(MATCH_ID);

    expect(result).toEqual({
      matchId: MATCH_ID,
      winnerId: PLAYER_A,
      resigned: true,
    });
    expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "forfeit", PLAYER_A);
  });

  it("throws when match is not found", async () => {
    mockSession(PLAYER_A);
    const mock = makeSupabaseMock(null, { message: "Not found" });
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as any);

    await expect(resignMatch(MATCH_ID)).rejects.toThrow(
      "Match not found.",
    );
  });
});
