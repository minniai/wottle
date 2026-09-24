import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn().mockResolvedValue({
    token: "tok",
    issuedAt: Date.now(),
    player: {
      id: "viewer",
      username: "viewer",
      displayName: "Viewer",
      status: "available",
      lastSeenAt: new Date().toISOString(),
      eloRating: 1200,
      avatarUrl: null,
    },
  }),
}));
const getPlayerProfileMock = vi.fn();
vi.mock("@/app/actions/player/getPlayerProfile", () => ({
  getPlayerProfile: (...args: unknown[]) => getPlayerProfileMock(...args),
}));

import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import { getServiceRoleClient } from "@/lib/supabase/server";

function buildLookupChain(result: { data: { id: string } | null; error: unknown }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  getPlayerProfileMock.mockReset();
  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn(() => buildLookupChain({ data: { id: "p1" }, error: null })),
  } as never);
});

describe("getPlayerProfileByHandle", () => {
  test("looks up player by lowercased username and delegates to getPlayerProfile", async () => {
    getPlayerProfileMock.mockResolvedValue({
      status: "ok",
      profile: { identity: { id: "p1" } } as never,
    });
    const result = await getPlayerProfileByHandle("ARI");
    expect(getPlayerProfileMock).toHaveBeenCalledWith("p1", "is");
    expect(result.status).toBe("ok");
  });

  test("returns not_found when no player matches the handle", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() => buildLookupChain({ data: null, error: null })),
    } as never);
    const result = await getPlayerProfileByHandle("ghost");
    expect(result.status).toBe("not_found");
    expect(getPlayerProfileMock).not.toHaveBeenCalled();
  });

  test("returns error when handle is empty", async () => {
    const result = await getPlayerProfileByHandle("");
    expect(result.status).toBe("error");
    expect(getPlayerProfileMock).not.toHaveBeenCalled();
  });

  test("returns error when handle is over 24 chars", async () => {
    const result = await getPlayerProfileByHandle("a".repeat(25));
    expect(result.status).toBe("error");
  });
});

describe("a handle with an Icelandic letter (reported 2026-09-24)", () => {
  test("arrives percent-encoded from the route and still finds the player", async () => {
    const chain = buildLookupChain({ data: { id: "p-kari" }, error: null });
    vi.mocked(getServiceRoleClient).mockReturnValue({ from: vi.fn(() => chain) } as never);
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: {} });
    const result = await getPlayerProfileByHandle("k%C3%A1ri94389", "is");
    expect(result.status).toBe("ok");
    expect(chain.eq).toHaveBeenCalledWith("username", "kári94389");
  });

  test("a decomposed á is read as the one letter", async () => {
    const chain = buildLookupChain({ data: { id: "p-kari" }, error: null });
    vi.mocked(getServiceRoleClient).mockReturnValue({ from: vi.fn(() => chain) } as never);
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: {} });
    await getPlayerProfileByHandle("kári94389", "is");
    expect(chain.eq).toHaveBeenCalledWith("username", "kári94389");
  });

  test("a malformed escape is refused, not thrown", async () => {
    expect((await getPlayerProfileByHandle("k%E0%A4%A", "is")).status).toBe("error");
  });
});
