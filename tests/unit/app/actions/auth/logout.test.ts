import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LobbySession } from "@/lib/matchmaking/profile";

vi.mock("server-only", () => ({}));

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({ rpc })),
}));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
}));
vi.mock("@/lib/matchmaking/service", () => ({
  expireLobbyPresence: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/matchmaking/presenceCache", () => ({
  forgetPresence: vi.fn(),
}));
vi.mock("@/lib/rate-limiting/middleware", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limiting/middleware")>("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn() };
});
// Spec 067 FR-013: signing out never resigns. Loading the resign action at all fails the suite.
vi.mock("@/app/actions/match/resignMatch", () => {
  throw new Error("logout must not import resignMatch");
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const jar = vi.hoisted(() => new Map<string, { value: string; options?: Record<string, unknown> }>());
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => jar.set(name, { value, options }),
    delete: (name: string | { name: string }) => jar.delete(typeof name === "string" ? name : name.name),
  })),
}));

import { logoutAction } from "@/app/actions/auth/logout";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { expireLobbyPresence } from "@/lib/matchmaking/service";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { revalidatePath } from "next/cache";

const SESSION: LobbySession = {
  issuedAt: 0,
  expiresAt: 3_600_000,
  player: { id: "player-1", username: "ari", displayName: "Ari" },
};

function signedIn(): void {
  vi.mocked(readLobbySession).mockResolvedValue(SESSION);
  jar.set("wottle-playtest-session", { value: "v1.x.y" });
  jar.set("wottle-device", { value: "k".repeat(43) });
}

describe("logoutAction (spec 067: signing out never costs a match)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jar.clear();
    rpc.mockResolvedValue({ data: { status: "signed_out" }, error: null });
  });

  it("returns signed-out and touches nothing when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    expect(await logoutAction()).toEqual({ status: "signed-out" });
    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is refused during a live match, and keeps the session", async () => {
    signedIn();
    rpc.mockResolvedValue({ data: { status: "in_match", match_id: "m1" }, error: null });

    expect(await logoutAction()).toEqual({ status: "refused", code: "sign_out_in_match" });
    expect(expireLobbyPresence).not.toHaveBeenCalled();
    expect(jar.has("wottle-playtest-session")).toBe(true);
  });

  it("otherwise ends the player's commitments, clears presence and the session, and marks the browser signed out", async () => {
    signedIn();

    expect(await logoutAction()).toEqual({ status: "signed-out" });
    expect(rpc).toHaveBeenCalledWith("sign_out_player", { p_player: "player-1" });
    expect(expireLobbyPresence).toHaveBeenCalledWith(expect.anything(), "player-1");
    expect(jar.has("wottle-playtest-session")).toBe(false);
    expect(jar.get("wottle-signed-out")).toMatchObject({ value: "1", options: expect.objectContaining({ httpOnly: true }) });
  });

  it("keeps the device key, so the door can greet the player by name", async () => {
    signedIn();
    await logoutAction();
    expect(jar.get("wottle-device")?.value).toBe("k".repeat(43));
  });

  it("revalidates no path: a layout-wide revalidation turns the static /rules pages into 404s", async () => {
    signedIn();
    await logoutAction();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rate-limits against the auth:logout scope", async () => {
    signedIn();
    await logoutAction();
    expect(assertWithinRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "player-1", scope: "auth:logout", limit: 10, windowMs: 60_000 }),
    );
  });
});
