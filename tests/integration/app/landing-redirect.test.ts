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
import LandingPage from "@/app/[locale]/(room)/page";
import { LobbyRoomPage } from "@/app/[locale]/(room)/LobbyRoomPage";

const session = {
  expiresAt: Date.now() + 3_600_000,
  issuedAt: Date.now(),
  player: {
    id: "abc",
    username: "ari",
    displayName: "Ari",
  },
};

/**
 * `/` and `/lobby` are one room (spec 044 US7). The server never redirects a
 * signed-in visitor away from `/`: the cookie-setting login action makes the
 * router re-render the current route, and a redirect there swapped the page
 * segment and remounted the field. The client rewrites the URL to /lobby.
 */
describe("LandingPage route", () => {
  test("renders the signed-in lobby room at / — no redirect", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(session);
    const element = await LandingPage();
    expect(element.type).toBe(LobbyRoomPage);
    expect(element.props.session).toEqual(session);
  });

  test("renders the empty-seat room when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    const element = await LandingPage();
    expect(element.type).toBe(LobbyRoomPage);
    expect(element.props.session).toBeNull();
  });
});
