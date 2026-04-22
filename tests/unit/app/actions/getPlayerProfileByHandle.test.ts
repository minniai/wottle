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
    expect(getPlayerProfileMock).toHaveBeenCalledWith("p1");
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
