import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LobbyCard } from "../../../../components/lobby/LobbyCard";
import type { PlayerIdentity } from "../../../../lib/types/match";

function makePlayer(overrides: Partial<PlayerIdentity> = {}): PlayerIdentity {
  return {
    id: "p1",
    username: "testuser",
    displayName: "Test User",
    status: "available",
    lastSeenAt: new Date().toISOString(),
    eloRating: 1350,
    ...overrides,
  };
}

describe("LobbyCard Elo display", () => {
  it("should render the player's Elo rating", () => {
    render(<LobbyCard player={makePlayer({ eloRating: 1350 })} />);
    expect(screen.getByTestId("lobby-elo-rating")).toHaveTextContent(
      "1350",
    );
  });

  it("should render 1200 as fallback for null eloRating", () => {
    render(
      <LobbyCard player={makePlayer({ eloRating: null })} />,
    );
    expect(screen.getByTestId("lobby-elo-rating")).toHaveTextContent(
      "1200",
    );
  });

  it("should render 1200 as fallback for undefined eloRating", () => {
    render(
      <LobbyCard
        player={makePlayer({ eloRating: undefined })}
      />,
    );
    expect(screen.getByTestId("lobby-elo-rating")).toHaveTextContent(
      "1200",
    );
  });

  it("should render positive Elo difference in green", () => {
    render(
      <LobbyCard
        player={makePlayer({ eloRating: 1350 })}
        viewerRating={1180}
      />,
    );
    const diff = screen.getByTestId("lobby-elo-diff");
    expect(diff).toHaveTextContent("+170");
    expect(diff.className).toContain("text-emerald");
  });

  it("should render negative Elo difference in red", () => {
    render(
      <LobbyCard
        player={makePlayer({ eloRating: 1180 })}
        viewerRating={1350}
      />,
    );
    const diff = screen.getByTestId("lobby-elo-diff");
    expect(diff).toHaveTextContent("-170");
    expect(diff.className).toContain("text-rose");
  });

  it("should render zero Elo difference as neutral", () => {
    render(
      <LobbyCard
        player={makePlayer({ eloRating: 1200 })}
        viewerRating={1200}
      />,
    );
    const diff = screen.getByTestId("lobby-elo-diff");
    expect(diff).toHaveTextContent("±0");
  });

  it("should not render Elo difference when viewerRating is omitted", () => {
    render(<LobbyCard player={makePlayer({ eloRating: 1350 })} />);
    expect(screen.queryByTestId("lobby-elo-diff")).toBeNull();
  });
});
