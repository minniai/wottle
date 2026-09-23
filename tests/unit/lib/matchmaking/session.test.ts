import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));

const jar = vi.hoisted(() => new Map<string, { value: string; options?: unknown }>());
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: unknown) => jar.set(name, { value, options }),
    delete: (name: string | { name: string }) => jar.delete(typeof name === "string" ? name : name.name),
  })),
}));

import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { signSession } from "@/lib/auth/sessionToken";
import { requireSessionSecret } from "@/lib/auth/sessionSecret";
import { persistLobbySession, readLobbySession } from "@/lib/matchmaking/profile";

const PLAYER = { id: "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f", username: "birna", displayName: "Birna" };

function setCookie(value: string): void {
  jar.set(SESSION_COOKIE_NAME, { value });
}

function rejectionsLogged(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map((call: unknown[]) => String(call[0]))
    .filter((line: string) => line.includes("auth.session.rejected"));
}

describe("readLobbySession (spec 067)", () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };

  beforeEach(() => {
    jar.clear();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("should read back the session persistLobbySession wrote", async () => {
    await persistLobbySession({ player: PLAYER });
    const session = await readLobbySession();
    expect(session?.player).toEqual(PLAYER);
    expect(session!.expiresAt - session!.issuedAt).toBe(4 * 60 * 60 * 1000);
  });

  it("should write the cookie signed, never as readable JSON", async () => {
    await persistLobbySession({ player: PLAYER });
    expect(jar.get(SESSION_COOKIE_NAME)!.value).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
  });

  it("should return null when there is no cookie", async () => {
    await expect(readLobbySession()).resolves.toBeNull();
  });

  it("should return null for the old unsigned cookie naming a real player", async () => {
    setCookie(Buffer.from(JSON.stringify({ token: "t", player: { ...PLAYER, status: "available", lastSeenAt: "" }, issuedAt: Date.now() })).toString("base64url"));
    await expect(readLobbySession()).resolves.toBeNull();
  });

  it("should return null when one character of a signed cookie changes", async () => {
    await persistLobbySession({ player: PLAYER });
    const value = jar.get(SESSION_COOKIE_NAME)!.value;
    setCookie(value.slice(0, 6) + (value[6] === "A" ? "B" : "A") + value.slice(7));
    await expect(readLobbySession()).resolves.toBeNull();
    expect(rejectionsLogged(warn)[0]).toMatch(/"reason":"bad_mac"/);
  });

  it("should return null for an expired session", async () => {
    const now = Date.now();
    setCookie(signSession({ playerId: PLAYER.id, username: "birna", displayName: "Birna", issuedAt: now - 10, expiresAt: now - 1 }, requireSessionSecret()));
    await expect(readLobbySession()).resolves.toBeNull();
    expect(rejectionsLogged(warn)[0]).toMatch(/"reason":"expired"/);
  });
});
