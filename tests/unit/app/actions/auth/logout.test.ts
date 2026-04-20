import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/rate-limiting/middleware", () => ({
  assertWithinRateLimit: vi.fn(),
}));
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
import { expireLobbyPresence } from "@/lib/matchmaking/service";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { resignMatch } from "@/app/actions/match/resignMatch";

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
    vi.mocked(readLobbySession).mockResolvedValue({
      token: "t",
      issuedAt: 0,
      player: {
        id: "player-1",
        username: "ari",
        displayName: "Ari",
        status: "available",
        lastSeenAt: "",
      },
    } as any);

    const result = await logoutAction();

    expect(result).toEqual({ status: "signed-out", resignedMatchId: null });
    expect(expireLobbyPresence).toHaveBeenCalledWith(expect.anything(), "player-1");
    expect(deleteCookie).toHaveBeenCalledWith("wottle-playtest-session");
  });

  it("does not resign when the opt-in flag is absent", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({
      token: "t",
      issuedAt: 0,
      player: {
        id: "player-1",
        username: "ari",
        displayName: "Ari",
        status: "in_match",
        lastSeenAt: "",
      },
    } as any);

    await logoutAction();

    expect(resignMatch).not.toHaveBeenCalled();
  });

  it("resigns the active match when opted in and a match is live", async () => {
    const { findActiveMatchForPlayer } = await import("@/lib/matchmaking/service");
    vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce({
      id: "match-42",
      state: "in_progress",
      created_at: "2026-04-20T00:00:00Z",
    } as any);
    vi.mocked(readLobbySession).mockResolvedValue({
      token: "t",
      issuedAt: 0,
      player: {
        id: "player-1",
        username: "ari",
        displayName: "Ari",
        status: "in_match",
        lastSeenAt: "",
      },
    } as any);

    const result = await logoutAction({ resignActiveMatch: true });

    expect(resignMatch).toHaveBeenCalledWith("match-42");
    expect(result.resignedMatchId).toBe("match-42");
  });

  it("continues with teardown when resignMatch throws", async () => {
    const { findActiveMatchForPlayer } = await import("@/lib/matchmaking/service");
    vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce({
      id: "match-42",
      state: "in_progress",
      created_at: "2026-04-20T00:00:00Z",
    } as any);
    vi.mocked(resignMatch).mockRejectedValueOnce(new Error("match ended"));
    vi.mocked(readLobbySession).mockResolvedValue({
      token: "t",
      issuedAt: 0,
      player: {
        id: "player-1",
        username: "ari",
        displayName: "Ari",
        status: "in_match",
        lastSeenAt: "",
      },
    } as any);

    const result = await logoutAction({ resignActiveMatch: true });

    expect(deleteCookie).toHaveBeenCalled();
    expect(result.resignedMatchId).toBeNull();
  });

  it("skips resign when no active match is found", async () => {
    const { findActiveMatchForPlayer } = await import("@/lib/matchmaking/service");
    vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce(null);
    vi.mocked(readLobbySession).mockResolvedValue({
      token: "t",
      issuedAt: 0,
      player: {
        id: "player-1",
        username: "ari",
        displayName: "Ari",
        status: "available",
        lastSeenAt: "",
      },
    } as any);

    const result = await logoutAction({ resignActiveMatch: true });

    expect(resignMatch).not.toHaveBeenCalled();
    expect(result.resignedMatchId).toBeNull();
  });
});
