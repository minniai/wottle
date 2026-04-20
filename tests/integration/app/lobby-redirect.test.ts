import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
  fetchLobbySnapshot: vi.fn(),
  healStuckInMatchStatus: vi.fn(),
}));

vi.mock("@/app/actions/player/getTopPlayers", () => ({
  getTopPlayers: vi.fn(async () => ({ players: [] })),
}));
vi.mock("@/app/actions/match/getRecentGames", () => ({
  getRecentGames: vi.fn(async () => ({ games: [] })),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import LobbyPage from "@/app/(lobby)/page";

describe("LobbyPage route", () => {
  test("redirects to / when no session cookie is present", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(LobbyPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });
});
