import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LobbyDirectory } from "@/components/lobby/LobbyDirectory";
import type { PlayerIdentity } from "@/lib/types/match";

function player(
  id: string,
  overrides: Partial<PlayerIdentity> = {},
): PlayerIdentity {
  return {
    id,
    username: id,
    displayName: id,
    status: "available",
    lastSeenAt: new Date().toISOString(),
    eloRating: 1200,
    ...overrides,
  };
}

const noop = () => {};

describe("LobbyDirectory", () => {
  test("renders skeleton placeholders while presence is not ready", () => {
    render(
      <LobbyDirectory
        players={[]}
        selfId="me"
        viewerRating={1200}
        connectionStatus="connecting"
        onChallenge={noop}
      />,
    );
    expect(screen.getAllByTestId("lobby-skeleton-card").length).toBeGreaterThan(
      0,
    );
  });

  test("renders empty state with share-invite affordance when only self is online", () => {
    const self = player("me");
    render(
      <LobbyDirectory
        players={[self]}
        selfId="me"
        viewerRating={1200}
        connectionStatus="ready"
        onChallenge={noop}
      />,
    );
    expect(screen.getByTestId("empty-lobby-state")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /join the queue/i }),
    ).toBeInTheDocument();
  });

  test("caps the visible cards at 24 and renders 'Show all' when more players are online", () => {
    const self = player("me");
    const others = Array.from({ length: 40 }, (_, i) =>
      player(`p${i}`, { eloRating: 1200 }),
    );
    render(
      <LobbyDirectory
        players={[self, ...others]}
        selfId="me"
        viewerRating={1200}
        connectionStatus="ready"
        onChallenge={noop}
      />,
    );
    expect(screen.getAllByTestId("lobby-card")).toHaveLength(24);
    const showAll = screen.getByTestId("lobby-directory-show-all");
    expect(showAll.textContent).toMatch(/show all/i);
  });

  test("always pins self into the visible set even past the cap", () => {
    const self = player("me", { status: "offline" });
    const others = Array.from({ length: 40 }, (_, i) =>
      player(`p${i}`, { eloRating: 1100 }),
    );
    render(
      <LobbyDirectory
        players={[...others, self]}
        selfId="me"
        viewerRating={1500}
        connectionStatus="ready"
        onChallenge={noop}
      />,
    );
    const visibleIds = screen
      .getAllByTestId("lobby-card")
      .map((card) => card.getAttribute("data-player-id"));
    expect(visibleIds).toContain("me");
  });

  test("activating 'Show all' reveals the hidden cards inline", () => {
    const self = player("me");
    const others = Array.from({ length: 30 }, (_, i) =>
      player(`p${i}`, { eloRating: 1200 }),
    );
    render(
      <LobbyDirectory
        players={[self, ...others]}
        selfId="me"
        viewerRating={1200}
        connectionStatus="ready"
        onChallenge={noop}
      />,
    );
    expect(screen.getAllByTestId("lobby-card")).toHaveLength(24);
    act(() => {
      screen.getByTestId("lobby-directory-show-all").click();
    });
    expect(screen.getAllByTestId("lobby-card")).toHaveLength(31);
  });
});
