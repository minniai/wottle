import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
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

const deleteCookie = vi.fn();
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
});
