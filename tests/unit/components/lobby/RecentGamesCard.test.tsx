import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RecentGamesCard } from "@/components/lobby/RecentGamesCard";
import type { RecentGameRow } from "@/lib/types/lobby";

const games: RecentGameRow[] = [
  {
    matchId: "m-1",
    result: "win",
    opponentId: "p-2",
    opponentUsername: "halli",
    opponentDisplayName: "Halli",
    yourScore: 312,
    opponentScore: 278,
    wordsFound: 18,
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    matchId: "m-2",
    result: "loss",
    opponentId: "p-3",
    opponentUsername: "thori",
    opponentDisplayName: "Thori",
    yourScore: 244,
    opponentScore: 301,
    wordsFound: 14,
    completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    matchId: "m-3",
    result: "draw",
    opponentId: "p-4",
    opponentUsername: "stella",
    opponentDisplayName: "Stella",
    yourScore: 210,
    opponentScore: 210,
    wordsFound: 12,
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe("RecentGamesCard", () => {
  test("renders panel head", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText("Your recent games")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  test("renders one row per game", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getAllByTestId("recent-game-row")).toHaveLength(3);
  });

  test("shows W/L/D chip per row", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText("W")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  test("row shows opponent handle and score", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText(/@halli/)).toBeInTheDocument();
    expect(screen.getByText(/312\s*–\s*278/)).toBeInTheDocument();
  });

  test("row shows words count", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText("18 words")).toBeInTheDocument();
    expect(screen.getByText("14 words")).toBeInTheDocument();
    expect(screen.getByText("12 words")).toBeInTheDocument();
  });

  test("empty list shows 'no recent games' placeholder", () => {
    render(<RecentGamesCard games={[]} />);
    expect(screen.getByText(/No recent games/i)).toBeInTheDocument();
  });
});
