import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PostGameScoreboard } from "@/components/match/PostGameScoreboard";

const baseEntry = {
  id: "p-a",
  displayName: "Ásta",
  slot: "player_a" as const,
  score: 312,
  wordsCount: 18,
  frozenTileCount: 14,
  bestWord: "HESTUR",
  ratingDelta: 18,
  isCurrentPlayer: true,
  isWinner: true,
};

const oppEntry = {
  id: "p-b",
  displayName: "Sigríður",
  slot: "player_b" as const,
  score: 278,
  wordsCount: 15,
  frozenTileCount: 11,
  bestWord: "FISKUR",
  ratingDelta: -18,
  isCurrentPlayer: false,
  isWinner: false,
};

describe("PostGameScoreboard", () => {
  test("renders two cards for the two entries", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    expect(screen.getAllByTestId("post-game-scoreboard-card")).toHaveLength(2);
  });

  test("cards carry slot-specific classes", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    const cards = screen.getAllByTestId("post-game-scoreboard-card");
    expect(cards[0].className).toContain("hud-card--you");
    expect(cards[1].className).toContain("hud-card--opp");
  });

  test("renders display name, score, and rating delta", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    expect(screen.getByText("Ásta")).toBeInTheDocument();
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText("+18 rating")).toBeInTheDocument();
    expect(screen.getByText("Sigríður")).toBeInTheDocument();
    expect(screen.getByText("278")).toBeInTheDocument();
    expect(screen.getByText("−18 rating")).toBeInTheDocument();
  });

  test("shows 'Rating pending' when ratingDelta is undefined", () => {
    render(
      <PostGameScoreboard
        entries={[
          { ...baseEntry, ratingDelta: undefined },
          oppEntry,
        ]}
      />,
    );
    expect(screen.getByText("Rating pending")).toBeInTheDocument();
  });

  test("foot row shows words, frozen count, and best word", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    const [firstCard] = screen.getAllByTestId("post-game-scoreboard-card");
    expect(within(firstCard).getByText("18 words")).toBeInTheDocument();
    expect(within(firstCard).getByText("14 frozen")).toBeInTheDocument();
    // Check for best word in the footer row
    const footerDiv = within(firstCard).getByText("14 frozen").parentElement;
    expect(footerDiv?.textContent).toContain("best");
    expect(footerDiv?.textContent).toContain("HESTUR");
  });

  test("renders em-dash when bestWord is null", () => {
    render(
      <PostGameScoreboard
        entries={[
          { ...baseEntry, bestWord: null },
          oppEntry,
        ]}
      />,
    );
    const [firstCard] = screen.getAllByTestId("post-game-scoreboard-card");
    // Check for best word em-dash in the footer row
    const footerDiv = within(firstCard).getByText("14 frozen").parentElement;
    expect(footerDiv?.textContent).toContain("best");
    expect(footerDiv?.textContent).toContain("—");
  });
});
