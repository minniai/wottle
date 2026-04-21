import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import MatchmakingPage from "@/app/matchmaking/page";

describe("MatchmakingPage route", () => {
  test("redirects to / when no session cookie is present", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(MatchmakingPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  test("renders when a session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({
      token: "tok",
      issuedAt: Date.now(),
      player: {
        id: "abc",
        username: "ari",
        displayName: "Ari",
        status: "available",
        lastSeenAt: new Date().toISOString(),
        eloRating: 1234,
      },
    });
    const element = await MatchmakingPage();
    expect(element).toBeTruthy();
  });
});
