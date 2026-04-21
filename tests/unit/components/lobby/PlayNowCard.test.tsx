import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerIdentity } from "@/lib/types/match";

const pushMock = vi.fn();

const mockStoreState: {
  players: PlayerIdentity[];
} = {
  players: [],
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/matchmaking/presenceStore", () => ({
  useLobbyPresenceStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

import { PlayNowCard } from "@/components/lobby/PlayNowCard";

const SELF: PlayerIdentity = {
  id: "me",
  username: "me",
  displayName: "Me",
  status: "available",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1200,
};

function seedSelf(status: PlayerIdentity["status"] = "available") {
  mockStoreState.players = [{ ...SELF, status }];
}

beforeEach(() => {
  mockStoreState.players = [];
  pushMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlayNowCard", () => {
  test("Ranked mode pill is pre-selected (static)", () => {
    render(<PlayNowCard currentPlayer={SELF} />);
    expect(
      screen.getByTestId("mode-pill-ranked").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("Casual and Challenge are aria-disabled with Coming soon copy", () => {
    render(<PlayNowCard currentPlayer={SELF} />);
    const casual = screen.getByTestId("mode-pill-casual");
    const challenge = screen.getByTestId("mode-pill-challenge");
    expect(casual.getAttribute("aria-disabled")).toBe("true");
    expect(challenge.getAttribute("aria-disabled")).toBe("true");
    expect(casual.textContent?.toLowerCase()).toContain("coming soon");
    expect(challenge.textContent?.toLowerCase()).toContain("coming soon");
  });

  test("idle-available: Play Now button is enabled and carries legacy test id", () => {
    render(<PlayNowCard currentPlayer={SELF} />);
    const btn = screen.getByTestId("matchmaker-start-button");
    expect(btn).not.toBeDisabled();
    expect(btn.textContent?.toLowerCase()).toContain("play now");
  });

  test("clicking Play Now navigates to /matchmaking", () => {
    render(<PlayNowCard currentPlayer={SELF} />);
    fireEvent.click(screen.getByTestId("matchmaker-start-button"));
    expect(pushMock).toHaveBeenCalledWith("/matchmaking");
  });

  test("disabled-while-in-match: Play Now is disabled with accessible explanation", () => {
    seedSelf("in_match");
    render(<PlayNowCard currentPlayer={SELF} />);
    const btn = screen.getByTestId("matchmaker-start-button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-label")?.toLowerCase()).toContain("already");
    expect(btn.textContent?.toLowerCase()).toContain("already in a match");
  });

  test("disabled click does not navigate", () => {
    seedSelf("in_match");
    render(<PlayNowCard currentPlayer={SELF} />);
    fireEvent.click(screen.getByTestId("matchmaker-start-button"));
    expect(pushMock).not.toHaveBeenCalled();
  });
});
