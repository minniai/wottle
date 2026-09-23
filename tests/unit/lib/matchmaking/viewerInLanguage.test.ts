import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const row = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row.current, error: null }) }) }),
    }),
  })),
}));
vi.mock("@/lib/rating/playerRatings", () => ({
  readEloRatings: vi.fn(async () => new Map([["p1", 1310]])),
}));

import { viewerInLanguage } from "@/lib/matchmaking/profile";

const SESSION_PLAYER = { id: "p1", username: "birna", displayName: "Birna" };

describe("viewerInLanguage (spec 067)", () => {
  beforeEach(() => {
    row.current = null;
  });

  it("should read the status the session no longer carries, and the language's rating", async () => {
    row.current = { status: "in_match", avatar_url: null, last_seen_at: "2026-09-23T10:00:00Z" };
    await expect(viewerInLanguage(SESSION_PLAYER, "en")).resolves.toEqual({
      ...SESSION_PLAYER,
      status: "in_match",
      avatarUrl: null,
      lastSeenAt: "2026-09-23T10:00:00Z",
      eloRating: 1310,
    });
  });

  it("should fall back to available when the player row cannot be read", async () => {
    await expect(viewerInLanguage(SESSION_PLAYER, "en")).resolves.toMatchObject({ ...SESSION_PLAYER, status: "available", eloRating: 1310 });
  });
});
