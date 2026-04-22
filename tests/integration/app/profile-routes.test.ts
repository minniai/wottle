import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
}));

vi.mock("@/app/actions/player/getPlayerProfile", () => ({
  getPlayerProfile: vi.fn(),
}));

vi.mock("@/app/actions/player/getPlayerProfileByHandle", () => ({
  getPlayerProfileByHandle: vi.fn(),
}));

vi.mock("@/app/actions/player/getBestWords", () => ({
  getBestWords: vi.fn(async () => ({ status: "ok", words: [] })),
}));

vi.mock("@/app/actions/match/getRecentGames", () => ({
  getRecentGames: vi.fn(async () => ({ games: [] })),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import OwnProfilePage from "@/app/profile/page";
import PublicProfilePage from "@/app/profile/[handle]/page";

const FAKE_PROFILE = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: "2026-01-01T00:00:00Z",
    eloRating: 1234,
  },
  stats: {
    eloRating: 1234,
    gamesPlayed: 1,
    wins: 1,
    losses: 0,
    draws: 0,
    winRate: 1,
  },
  ratingTrend: [],
  bestWord: null,
  form: [],
  peakRating: 1234,
  ratingHistory: [],
};

describe("/profile route", () => {
  test("redirects to / when no session", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(OwnProfilePage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  test("renders profile page when session + profile exist", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({
      token: "tok",
      issuedAt: Date.now(),
      player: FAKE_PROFILE.identity,
    });
    vi.mocked(getPlayerProfile).mockResolvedValueOnce({
      status: "ok",
      profile: FAKE_PROFILE,
    } as never);
    const element = await OwnProfilePage();
    expect(element).toBeTruthy();
  });
});

describe("/profile/[handle] route", () => {
  test("renders 'No such player' when handle has no match", async () => {
    vi.mocked(getPlayerProfileByHandle).mockResolvedValueOnce({
      status: "not_found",
    } as never);
    const element = await PublicProfilePage({
      params: Promise.resolve({ handle: "ghost" }),
    });
    expect(element).toBeTruthy();
  });

  test("renders profile page when handle resolves", async () => {
    vi.mocked(getPlayerProfileByHandle).mockResolvedValueOnce({
      status: "ok",
      profile: FAKE_PROFILE,
    } as never);
    const element = await PublicProfilePage({
      params: Promise.resolve({ handle: "ari" }),
    });
    expect(element).toBeTruthy();
  });
});
