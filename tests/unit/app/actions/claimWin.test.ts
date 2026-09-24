import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/heartbeatRepository", () => ({ readParticipants: vi.fn(async () => ({ stale: null, steppedOut: null })) }));
vi.mock("@/lib/match/disconnectStore", () => ({
  getDisconnectedAt: vi.fn(),
  RECONNECT_WINDOW_MS: 90_000,
}));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn(),
}));

import { claimWinAction } from "@/app/actions/match/claimWin";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { getDisconnectedAt } from "@/lib/match/disconnectStore";
import { readParticipants } from "@/lib/match/heartbeatRepository";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { resetRateLimitStoreForTests } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "00000000-0000-0000-0000-000000000001";
const PLAYER_A = "player-a-id";
const PLAYER_B = "player-b-id";

const SESSION = {
  token: "tok",
  issuedAt: Date.now(),
  player: {
    id: PLAYER_A,
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available" as const,
    lastSeenAt: new Date().toISOString(),
    eloRating: 1200,
  },
};

type QueryResult = { data: unknown; error: { message: string } | null };

function buildChain(result: QueryResult) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}

function buildSupabase(matchData: unknown) {
  return {
    from: vi.fn(() => buildChain({ data: matchData, error: null })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStoreForTests();
  vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
  vi.mocked(getServiceRoleClient).mockReturnValue(
    buildSupabase({
      state: "in_progress",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
      player_a_moves: 10,
      player_b_moves: 6,
      move_limit: 10,
    }) as never,
  );
  vi.mocked(getDisconnectedAt).mockReturnValue(null);
  vi.mocked(completeMatchInternal).mockResolvedValue({} as never);
});

describe("claimWinAction", () => {
  test("returns unauthenticated when no session", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("unauthenticated");
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  test("returns error when matchId is not a UUID", async () => {
    const result = await claimWinAction("not-a-uuid");

    expect(result.status).toBe("error");
    expect((result as { status: "error"; message: string }).message).toBe(
      "Invalid matchId.",
    );
  });

  test("returns error when match is not found", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase(null) as never,
    );

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("error");
    expect((result as { status: "error"; message: string }).message).toBe(
      "Match not found.",
    );
  });

  test("returns forbidden when caller is not a participant", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({
        state: "in_progress",
        player_a_id: "stranger-1",
        player_b_id: "stranger-2",
      }) as never,
    );

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("forbidden");
  });

  test("returns already_completed when match state is completed", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({
        state: "completed",
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
      }) as never,
    );

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("already_completed");
    expect((result as { status: "already_completed"; matchId: string }).matchId).toBe(MATCH_ID);
  });

  test("returns not_disconnected when opponent has no disconnect record", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(null);

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("not_disconnected");
  });

  test("the heartbeat's stale opponent counts as disconnected, as the loader reads it (spec 070)", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(null);
    vi.mocked(readParticipants).mockResolvedValueOnce({ stale: { playerId: PLAYER_B, disconnectedAt: new Date(Date.now() - 95_000).toISOString() }, steppedOut: null });
    const result = await claimWinAction(MATCH_ID);
    expect(result.status).toBe("ok");
  });

  test("an opponent who only stepped out to a page is not disconnected (spec 070 US8)", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 95_000);
    vi.mocked(readParticipants).mockResolvedValueOnce({ stale: null, steppedOut: PLAYER_B });
    const result = await claimWinAction(MATCH_ID);
    expect(result.status).toBe("not_disconnected");
  });

  test("returns too_early when opponent disconnected 30s ago", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 30_000);

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("too_early");
    const remaining = (result as { status: "too_early"; remainingMs: number }).remainingMs;
    expect(remaining).toBeGreaterThan(59_000);
    expect(remaining).toBeLessThan(61_000);
  });

  test("returns ok and ends the match under the normal rules when the opponent disconnected 95s ago", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 95_000);

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("ok");
    expect((result as { status: "ok"; matchId: string }).matchId).toBe(MATCH_ID);
    // Spec 050 FR-012: no forced winner. The caller has ten moves and the
    // absent opponent does not, so the rules give the caller the win.
    expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "natural");
  });

  test("returns not_done while the caller is short of the move limit (spec 050 FR-012)", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildSupabase({
        state: "in_progress",
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
        player_a_moves: 7,
        player_b_moves: 6,
        move_limit: 10,
      }) as never,
    );
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 95_000);

    const result = await claimWinAction(MATCH_ID);

    expect(result).toEqual({ status: "not_done", movesPlayed: 7, moveLimit: 10 });
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  test("a refusal does not spend the one claim a minute: too_early, then ok once the window passes", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 89_950);
    const early = await claimWinAction(MATCH_ID);
    expect(early.status).toBe("too_early");

    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 90_100);
    const retry = await claimWinAction(MATCH_ID);

    expect(retry.status).toBe("ok");
    expect(completeMatchInternal).toHaveBeenCalledTimes(1);
  });

  test("returns rate_limited on the second call within the same minute", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 95_000);

    const first = await claimWinAction(MATCH_ID);
    expect(first.status).toBe("ok");

    const second = await claimWinAction(MATCH_ID);
    expect(second.status).toBe("rate_limited");
    expect(
      (second as { status: "rate_limited"; retryAfterSeconds: number })
        .retryAfterSeconds,
    ).toBeGreaterThan(0);
    // completeMatchInternal only runs for the first call.
    expect(completeMatchInternal).toHaveBeenCalledTimes(1);
  });
});
