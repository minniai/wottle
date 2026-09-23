import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
  viewerInLanguage: vi.fn(async (player: unknown) => player),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import MatchmakingPage from "@/app/[locale]/(room)/matchmaking/page";

describe("MatchmakingPage route", () => {
  test("redirects to / when no session cookie is present", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(MatchmakingPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  test("renders when a session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      player: { id: "abc", username: "ari", displayName: "Ari" },
    });
    const element = await MatchmakingPage();
    expect(element).toBeTruthy();
  });
});
