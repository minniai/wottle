import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/claim", () => ({ resolveClaim: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({
  enterClaimedPlayer: vi.fn(async (player: object) => ({ ...player, status: "available", lastSeenAt: "", eloRating: 1310 })),
  persistLobbySession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limiting/middleware", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limiting/middleware")>("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn(), resolveClientIp: vi.fn(() => "127.0.0.1") };
});

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string | { name: string }) => jar.delete(typeof name === "string" ? name : name.name),
  })),
}));

import { enterAsReturningAction } from "@/app/actions/auth/enterAsReturning";
import { resolveClaim } from "@/lib/auth/claim";
import { hashDeviceKey } from "@/lib/auth/deviceKey";
import { enterClaimedPlayer, persistLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";

const BIRNA = { id: "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f", username: "birna", displayName: "Birna" };
const KEY = "k".repeat(43);

describe("enterAsReturningAction (spec 067 FR-010)", () => {
  beforeEach(() => {
    jar.clear();
    vi.clearAllMocks();
  });

  it("should sign the browser in as its player, in the page's language, and clear the signed-out mark", async () => {
    jar.set("wottle-device", KEY);
    jar.set("wottle-signed-out", "1");
    vi.mocked(resolveClaim).mockResolvedValue(BIRNA);

    const result = await enterAsReturningAction("en");

    expect(resolveClaim).toHaveBeenCalledWith(expect.anything(), hashDeviceKey(KEY));
    expect(enterClaimedPlayer).toHaveBeenCalledWith(BIRNA, "en");
    expect(persistLobbySession).toHaveBeenCalledWith({ player: expect.objectContaining({ id: BIRNA.id }) }, expect.anything());
    expect(result).toMatchObject({ status: "success", player: { id: BIRNA.id, eloRating: 1310 } });
    expect(jar.has("wottle-signed-out")).toBe(false);
    expect(jar.get("wottle-device")).toBe(KEY);
  });

  it("should refuse, and forget the key, when it claims no name", async () => {
    jar.set("wottle-device", KEY);
    vi.mocked(resolveClaim).mockResolvedValue(null);
    await expect(enterAsReturningAction("en")).resolves.toEqual({ status: "error", code: "login_failed" });
    expect(jar.has("wottle-device")).toBe(false);
    expect(persistLobbySession).not.toHaveBeenCalled();
  });

  it("should refuse a browser with no device key", async () => {
    await expect(enterAsReturningAction("en")).resolves.toEqual({ status: "error", code: "login_failed" });
    expect(resolveClaim).not.toHaveBeenCalled();
  });

  it("should count against the sign-in rate limit", async () => {
    jar.set("wottle-device", KEY);
    vi.mocked(resolveClaim).mockResolvedValue(BIRNA);
    await enterAsReturningAction("is");
    expect(assertWithinRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: "auth:login" }));
  });
});
