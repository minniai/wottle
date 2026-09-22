import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/profile", () => ({
  LoginValidationError: class LoginValidationError extends Error {},
  performUsernameLogin: vi.fn(),
  persistLobbySession: vi.fn().mockResolvedValue(undefined),
  viewerInLanguage: vi.fn(async (player: unknown) => player),
}));
vi.mock("@/lib/rate-limiting/middleware", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limiting/middleware")>("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn(), resolveClientIp: vi.fn(() => "127.0.0.1") };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

import { loginAction } from "@/app/actions/auth/login";
import { performUsernameLogin } from "@/lib/matchmaking/profile";
import { revalidatePath } from "next/cache";

const player = { id: "p1", username: "birna", displayName: "Birna", status: "available" as const, lastSeenAt: "", eloRating: 1200 };

describe("loginAction (spec 044 US7 — the room converts in place)", () => {
  beforeEach(() => {
    vi.mocked(performUsernameLogin).mockResolvedValue({ player, sessionToken: "tok" } as never);
    vi.mocked(revalidatePath).mockClear();
  });

  it("returns the player and does not revalidate the route — a server re-render of / would redirect to /lobby and remount the field", async () => {
    const form = new FormData();
    form.set("username", "birna");
    const result = await loginAction({ status: "idle" }, form);
    expect(result.status).toBe("success");
    expect(result.player).toEqual(player);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
