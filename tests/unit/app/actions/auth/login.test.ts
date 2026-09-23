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
const jar = vi.hoisted(() => new Map<string, { value: string; options?: Record<string, unknown> }>());
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => jar.set(name, { value, options }),
    delete: (name: string | { name: string }) => jar.delete(typeof name === "string" ? name : name.name),
  })),
}));

import { loginAction } from "@/app/actions/auth/login";
import { performUsernameLogin } from "@/lib/matchmaking/profile";
import { revalidatePath } from "next/cache";
import { assertWithinRateLimit, RateLimitExceededError } from "@/lib/rate-limiting/middleware";
import { hashDeviceKey } from "@/lib/auth/deviceKey";

const player = { id: "p1", username: "birna", displayName: "Birna", status: "available" as const, lastSeenAt: "", eloRating: 1200 };

describe("loginAction (spec 044 US7 — the room converts in place)", () => {
  beforeEach(() => {
    jar.clear();
    vi.mocked(assertWithinRateLimit).mockReset();
    vi.mocked(performUsernameLogin).mockReset().mockResolvedValue({ player } as never);
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

  it("never hands the session to the page: it lives only in the signed httpOnly cookie (spec 067)", async () => {
    const form = new FormData();
    form.set("username", "birna");
    const result = await loginAction({ status: "idle" }, form);
    expect(result).not.toHaveProperty("sessionToken");
  });

  function formFor(name: string): FormData {
    const form = new FormData();
    form.set("username", name);
    return form;
  }

  it("gives a browser with no device key a new one, and claims the name with its hash (spec 067)", async () => {
    await loginAction({ status: "idle" }, formFor("birna"));
    const device = jar.get("wottle-device");
    expect(device?.value).toMatch(/^[\w-]{43}$/);
    expect(device?.options).toMatchObject({ httpOnly: true, maxAge: 365 * 24 * 60 * 60 });
    expect(performUsernameLogin).toHaveBeenCalledWith("birna", "is", hashDeviceKey(device!.value));
  });

  it("claims with the key this browser already holds", async () => {
    jar.set("wottle-device", { value: "k".repeat(43) });
    await loginAction({ status: "idle" }, formFor("birna"));
    expect(performUsernameLogin).toHaveBeenCalledWith("birna", "is", hashDeviceKey("k".repeat(43)));
    expect(jar.get("wottle-device")?.value).toBe("k".repeat(43));
  });

  it("clears the signed-out mark on entering", async () => {
    jar.set("wottle-signed-out", { value: "1" });
    await loginAction({ status: "idle" }, formFor("birna"));
    expect(jar.has("wottle-signed-out")).toBe(false);
  });

  it("says the name is taken, and sets no cookie, when another browser holds it", async () => {
    vi.mocked(performUsernameLogin).mockRejectedValue(Object.assign(new Error("taken"), { name: "NameTakenError" }));
    const result = await loginAction({ status: "idle" }, formFor("birna"));
    expect(result).toMatchObject({ status: "error", code: "name_taken" });
    expect(jar.size).toBe(0);
  });

  it("checks the rate limit before looking at the name", async () => {
    vi.mocked(assertWithinRateLimit).mockImplementation(() => {
      throw new RateLimitExceededError("auth:login", 30, "slow down");
    });
    const result = await loginAction({ status: "idle" }, formFor("birna"));
    expect(result.code).toBe("rate_limited");
    expect(performUsernameLogin).not.toHaveBeenCalled();
  });
});
