import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), has: (name: string) => jar.has(name) })),
}));

const query = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (...args: unknown[]) => {
      query.eq(...args);
      return chain;
    };
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = async () => ({ data: query.row, error: null });
    return { from: () => chain };
  }),
}));
vi.mock("@/lib/rating/playerRatings", () => ({ readEloRatings: vi.fn(async () => new Map([["p1", 1310]])) }));

import { hashDeviceKey } from "@/lib/auth/deviceKey";
import { readReturningPlayer } from "@/lib/auth/returningPlayer";
import { readEloRatings } from "@/lib/rating/playerRatings";

const KEY = "k".repeat(43);

describe("readReturningPlayer (spec 067 US3)", () => {
  beforeEach(() => {
    jar.clear();
    query.row = { id: "p1", display_name: "Birna" };
    query.eq.mockClear();
  });

  it("should name the browser's latest player, with their rating in the page's language, after a sign-out", async () => {
    jar.set("wottle-device", KEY);
    jar.set("wottle-signed-out", "1");
    await expect(readReturningPlayer("en")).resolves.toEqual({ displayName: "Birna", rating: 1310 });
    expect(query.eq).toHaveBeenCalledWith("claim_hash", hashDeviceKey(KEY));
    expect(readEloRatings).toHaveBeenCalledWith(expect.anything(), ["p1"], "en");
  });

  it("should be null for a browser with no device key, or one that never signed out", async () => {
    jar.set("wottle-signed-out", "1");
    await expect(readReturningPlayer("en")).resolves.toBeNull();
    jar.clear();
    jar.set("wottle-device", KEY);
    await expect(readReturningPlayer("en")).resolves.toBeNull();
  });

  it("should be null when the key claims no name", async () => {
    jar.set("wottle-device", KEY);
    jar.set("wottle-signed-out", "1");
    query.row = null;
    await expect(readReturningPlayer("en")).resolves.toBeNull();
  });

  it("should leave the rating out when the player has none in this language", async () => {
    jar.set("wottle-device", KEY);
    jar.set("wottle-signed-out", "1");
    vi.mocked(readEloRatings).mockResolvedValueOnce(new Map());
    await expect(readReturningPlayer("is")).resolves.toEqual({ displayName: "Birna", rating: null });
  });
});
