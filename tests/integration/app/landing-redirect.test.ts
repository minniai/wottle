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
import LandingPage from "@/app/(landing)/page";

describe("LandingPage route", () => {
  test("redirects to /lobby when a session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({
      token: "tok",
      issuedAt: Date.now(),
      player: {
        id: "abc",
        username: "ari",
        displayName: "Ari",
        status: "available",
        lastSeenAt: new Date().toISOString(),
        eloRating: 1200,
      },
    });

    await expect(LandingPage()).rejects.toThrow("NEXT_REDIRECT:/lobby");
  });

  test("renders the landing screen when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    const element = await LandingPage();
    expect(element).toBeTruthy();
  });
});
