import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/matchmaking/profile");
  return {
    ...actual,
    performUsernameLogin: vi.fn(),
    persistLobbySession: vi.fn(),
  };
});

vi.mock("next/headers", () => {
  const jar = new Map<string, string>();
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
      set: (name: string, value: string) => jar.set(name, value),
      delete: (name: string) => jar.delete(name),
    })),
  };
});

import type { PlayerIdentity } from "@/lib/types/match";
import { NameTakenError } from "@/lib/auth/claim";
import { performUsernameLogin, persistLobbySession } from "@/lib/matchmaking/profile";
import { POST } from "@/app/api/auth/login/route";
import { resetRateLimitStoreForTests } from "@/lib/rate-limiting/middleware";

function createRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const player: PlayerIdentity = {
  id: "11111111-2222-3333-4444-555555555555",
  username: "tester",
  displayName: "Tester",
  avatarUrl: null,
  status: "available",
  lastSeenAt: new Date().toISOString(),
  eloRating: null,
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.mocked(performUsernameLogin).mockReset();
    vi.mocked(persistLobbySession).mockReset();
    resetRateLimitStoreForTests();
  });

  afterEach(() => {
    resetRateLimitStoreForTests();
  });

  it("returns 200 with player payload when login succeeds", async () => {
    vi.mocked(performUsernameLogin).mockResolvedValue({
      player,
    });

    const response = await POST(createRequest({ username: "tester" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    // The response names the player; the session itself is only ever the signed httpOnly cookie.
    expect(await response.json()).toEqual({ player });
    expect(performUsernameLogin).toHaveBeenCalledWith("tester", "is", expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(persistLobbySession).toHaveBeenCalledWith({ player }, expect.anything());
  });

  it("returns 409 name_taken when another browser holds the name (spec 067)", async () => {
    vi.mocked(performUsernameLogin).mockRejectedValue(new NameTakenError("tester"));
    const response = await POST(createRequest({ username: "tester" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "name_taken" });
    expect(persistLobbySession).not.toHaveBeenCalled();
  });

  it("returns 400 when username is missing", async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/username/i);
    expect(performUsernameLogin).not.toHaveBeenCalled();
  });

  it("returns 500 when the login helper throws", async () => {
    // Suppress console.error to avoid noisy stack trace in test output
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    vi.mocked(performUsernameLogin).mockRejectedValue(new Error("supabase down"));

    const response = await POST(createRequest({ username: "tester" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/supabase down/i);
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(performUsernameLogin).mockResolvedValue({
      player,
    });

    for (let i = 0; i < 5; i += 1) {
      const okResponse = await POST(createRequest({ username: `tester-${i}` }));
      expect(okResponse.status).toBe(200);
    }

    const blockedResponse = await POST(createRequest({ username: "tester-blocked" }));

    expect(blockedResponse.status).toBe(429);
    const body = await blockedResponse.json();
    expect(body.error).toMatch(/too many/i);
  });
});


