import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/matchmaking/profile");
  return {
    ...actual,
    readLobbySession: vi.fn(),
  };
});

vi.mock("@/lib/matchmaking/inviteService", () => ({
  startAutoQueue: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({})),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import { startAutoQueue } from "@/lib/matchmaking/inviteService";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/match/start/route";

const session = {
  token: "session-token",
  issuedAt: Date.now(),
  player: {
    id: "22222222-3333-4444-5555-666666666666",
    username: "queue-alpha",
    displayName: "Queue Alpha",
    status: "available" as const,
    lastSeenAt: new Date().toISOString(),
    avatarUrl: null,
  },
};

describe("POST /api/match/start", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockReset();
    vi.mocked(startAutoQueue).mockReset();
    vi.mocked(getServiceRoleClient).mockClear();
  });

  it("returns queue result when matchmaking succeeds", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(startAutoQueue).mockResolvedValue({
      status: "matched",
      matchId: "aaabbbcc-dddd-eeee-ffff-111122223333",
    });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        status: "matched",
        matchId: expect.any(String),
      })
    );
    expect(startAutoQueue).toHaveBeenCalledWith(expect.any(Object), {
      playerId: session.player.id,
    });
  });

  it("returns 401 when no lobby session is present", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(startAutoQueue).not.toHaveBeenCalled();
  });

  it("returns 500 when the queue helper throws", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(startAutoQueue).mockRejectedValue(new Error("supabase down"));

    const response = await POST();

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toMatch(/supabase down/i);
  });
});


