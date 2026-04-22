import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/app/actions/match/handleDisconnect", () => ({
  getDisconnectedAt: vi.fn(),
  RECONNECT_WINDOW_MS_EXPORT: 90_000,
}));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn(),
}));

import { claimWinAction } from "@/app/actions/match/claimWin";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { getDisconnectedAt } from "@/app/actions/match/handleDisconnect";
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

  test("returns too_early when opponent disconnected 30s ago", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 30_000);

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("too_early");
    const remaining = (result as { status: "too_early"; remainingMs: number }).remainingMs;
    expect(remaining).toBeGreaterThan(59_000);
    expect(remaining).toBeLessThan(61_000);
  });

  test("returns ok and forces caller as winner when opponent disconnected 95s ago", async () => {
    vi.mocked(getDisconnectedAt).mockReturnValue(Date.now() - 95_000);

    const result = await claimWinAction(MATCH_ID);

    expect(result.status).toBe("ok");
    expect((result as { status: "ok"; matchId: string }).matchId).toBe(MATCH_ID);
    // Caller (PLAYER_A) must be passed as forcedWinnerId so they win
    // unconditionally, regardless of the live scoreboard.
    expect(completeMatchInternal).toHaveBeenCalledWith(
      MATCH_ID,
      "disconnect",
      PLAYER_A,
    );
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
