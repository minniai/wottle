import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/matchmaking/profile");
  return {
    ...actual,
    readLobbySession: vi.fn(),
  };
});

vi.mock("@/lib/matchmaking/service", () => ({
  findActiveMatchForPlayer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({})),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import { findActiveMatchForPlayer } from "@/lib/matchmaking/service";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/match/active/route";

const session = {
  token: "session-token",
  issuedAt: Date.now(),
  player: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    username: "tester-alpha",
    displayName: "Tester Alpha",
    status: "available" as const,
    lastSeenAt: new Date().toISOString(),
    avatarUrl: null,
  },
};

describe("GET /api/match/active", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockReset();
    vi.mocked(findActiveMatchForPlayer).mockReset();
    vi.mocked(getServiceRoleClient).mockClear();
  });

  it("returns the active match summary when one exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue({
      id: "11111111-2222-3333-4444-555555555555",
      state: "pending",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        match: {
          id: expect.any(String),
          state: "pending",
        },
      })
    );
    expect(getServiceRoleClient).toHaveBeenCalled();
    expect(findActiveMatchForPlayer).toHaveBeenCalledWith(expect.any(Object), session.player.id);
  });

  it("returns null match when the user is not authenticated", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ match: null });
    expect(getServiceRoleClient).not.toHaveBeenCalled();
  });

  it("returns 500 when the lookup fails", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(findActiveMatchForPlayer).mockRejectedValue(new Error("supabase offline"));

    const response = await GET();

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.match).toBeNull();
    expect(payload.error).toMatch(/supabase offline/i);
  });
});


