import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
  SESSION_COOKIE_NAME: "wottle-playtest-session",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/lobby",
}));
vi.mock("@/app/actions/auth/logout", () => ({
  logoutAction: vi
    .fn()
    .mockResolvedValue({ status: "signed-out", resignedMatchId: null }),
}));
vi.mock("@/lib/matchmaking/presenceStore", () => ({
  useLobbyPresenceStore: { getState: () => ({ disconnect: vi.fn() }) },
}));

import { TopBar } from "@/components/ui/TopBar";
import { readLobbySession } from "@/lib/matchmaking/profile";

const authenticatedSession = {
  token: "t",
  issuedAt: 0,
  player: {
    id: "player-1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available" as const,
    lastSeenAt: "",
    eloRating: null,
  },
};

describe("TopBar", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
  });

  test("renders the Wottle wordmark", async () => {
    render(await TopBar());
    expect(screen.getByText("Wottle")).toBeInTheDocument();
  });

  test("renders the tagline", async () => {
    render(await TopBar());
    expect(screen.getByText("word · battle")).toBeInTheDocument();
  });

  test("renders a link to /lobby labelled 'Lobby'", async () => {
    render(await TopBar());
    const lobbyLink = screen.getByRole("link", { name: /lobby/i });
    expect(lobbyLink).toHaveAttribute("href", "/lobby");
  });

  test("renders a link to /profile labelled 'Profile'", async () => {
    render(await TopBar());
    const profileLink = screen.getByRole("link", { name: /profile/i });
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  test("root element is sticky with top-0", async () => {
    render(await TopBar());
    const root = screen.getByTestId("topbar");
    expect(root.className).toContain("sticky");
    expect(root.className).toContain("top-0");
  });

  test("root element uses paper background with backdrop blur", async () => {
    render(await TopBar());
    const root = screen.getByTestId("topbar");
    expect(root.className).toMatch(/bg-paper/);
    expect(root.className).toMatch(/backdrop-blur/);
  });

  test("renders UserMenu when session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(authenticatedSession);
    render(await TopBar());
    expect(screen.getByRole("button", { name: /ari/i })).toBeInTheDocument();
  });

  test("does not render UserMenu when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    render(await TopBar());
    expect(
      screen.queryByRole("button", { name: /sign out|ari/i }),
    ).not.toBeInTheDocument();
  });
});
