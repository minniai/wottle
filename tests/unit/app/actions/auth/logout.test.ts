import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LobbySession } from "@/lib/matchmaking/profile";
import type { LobbyStatus } from "@/lib/types/match";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
  SESSION_COOKIE_NAME: "wottle-playtest-session",
}));
vi.mock("@/lib/matchmaking/service", () => ({
  expireLobbyPresence: vi.fn().mockResolvedValue(undefined),
  findActiveMatchForPlayer: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/matchmaking/presenceCache", () => ({
  forgetPresence: vi.fn(),
}));
vi.mock("@/lib/rate-limiting/middleware", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/rate-limiting/middleware")
  >("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn() };
});
vi.mock("@/app/actions/match/resignMatch", () => ({
  resignMatch: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { deleteCookie } = vi.hoisted(() => ({ deleteCookie: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ delete: deleteCookie }),
}));

import { logoutAction } from "@/app/actions/auth/logout";
import { readLobbySession } from "@/lib/matchmaking/profile";
import {
  expireLobbyPresence,
  findActiveMatchForPlayer,
} from "@/lib/matchmaking/service";
import {
  assertWithinRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limiting/middleware";
import { resignMatch } from "@/app/actions/match/resignMatch";

function buildSession(
  overrides: Partial<LobbySession["player"]> = {},
): LobbySession {
  return {
    token: "t",
    issuedAt: 0,
    player: {
      id: "player-1",
      username: "ari",
      displayName: "Ari",
      avatarUrl: null,
      status: "available" as LobbyStatus,
      lastSeenAt: "",
      eloRating: null,
      ...overrides,
    },
  };
}

describe("logoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns signed-out and skips DB + cookie work when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const result = await logoutAction();

    expect(result).toEqual({ status: "signed-out", resignedMatchId: null });
    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expect(expireLobbyPresence).not.toHaveBeenCalled();
    expect(resignMatch).not.toHaveBeenCalled();
    expect(deleteCookie).not.toHaveBeenCalled();
  });

  it("clears presence row, presence cache, and session cookie for an active session", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(buildSession());

    const result = await logoutAction();

    expect(result).toEqual({ status: "signed-out", resignedMatchId: null });
    expect(expireLobbyPresence).toHaveBeenCalledWith(expect.anything(), "player-1");
    expect(deleteCookie).toHaveBeenCalledWith({
      name: "wottle-playtest-session",
      path: "/",
    });
  });

  it("does not resign when the opt-in flag is absent", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(
      buildSession({ status: "in_match" }),
    );

    await logoutAction();

    expect(resignMatch).not.toHaveBeenCalled();
  });

  it("resigns the active match when opted in and a match is live", async () => {
    vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce({
      id: "match-42",
      state: "in_progress",
      created_at: "2026-04-20T00:00:00Z",
    } as any);
    vi.mocked(readLobbySession).mockResolvedValue(
      buildSession({ status: "in_match" }),
    );

    const result = await logoutAction({ resignActiveMatch: true });

    expect(resignMatch).toHaveBeenCalledWith("match-42");
    expect(result.resignedMatchId).toBe("match-42");
  });

  it("continues with teardown when resignMatch throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce({
      id: "match-42",
      state: "in_progress",
      created_at: "2026-04-20T00:00:00Z",
    } as any);
    vi.mocked(resignMatch).mockRejectedValueOnce(new Error("match ended"));
    vi.mocked(readLobbySession).mockResolvedValue(
      buildSession({ status: "in_match" }),
    );

    const result = await logoutAction({ resignActiveMatch: true });

    expect(deleteCookie).toHaveBeenCalled();
    expect(result.resignedMatchId).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("resignMatch failed"),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it("rethrows RateLimitExceededError from resignMatch", async () => {
    vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce({
      id: "match-99",
      state: "in_progress",
      created_at: "2026-04-20T00:00:00Z",
    } as any);
    vi.mocked(resignMatch).mockRejectedValueOnce(
      new RateLimitExceededError("match:resign", 60, "Too many resigns."),
    );
    vi.mocked(readLobbySession).mockResolvedValue(
      buildSession({ status: "in_match" }),
    );

    await expect(
      logoutAction({ resignActiveMatch: true }),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
    expect(deleteCookie).not.toHaveBeenCalled();
  });

  it("skips resign when no active match is found", async () => {
    vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce(null);
    vi.mocked(readLobbySession).mockResolvedValue(buildSession());

    const result = await logoutAction({ resignActiveMatch: true });

    expect(resignMatch).not.toHaveBeenCalled();
    expect(result.resignedMatchId).toBeNull();
  });

  it("rate-limits against the auth:logout scope", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(buildSession());

    await logoutAction();

    expect(assertWithinRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "player-1",
        scope: "auth:logout",
        limit: 10,
        windowMs: 60_000,
      }),
    );
  });
});
