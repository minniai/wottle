import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TopOfBoardCard } from "@/components/lobby/TopOfBoardCard";
import type { TopPlayerRow } from "@/lib/types/lobby";

const players: TopPlayerRow[] = [
  { id: "p-1", username: "halli", displayName: "Hallgrímur", eloRating: 2014, avatarUrl: null, wins: 302, losses: 188 },
  { id: "p-2", username: "thori", displayName: "Þórarinn", eloRating: 1930, avatarUrl: null, wins: 201, losses: 156 },
  { id: "p-3", username: "sigga", displayName: "Sigríður", eloRating: 1842, avatarUrl: null, wins: 128, losses: 94 },
];

describe("TopOfBoardCard", () => {
  test("renders panel head with season label", () => {
    render(<TopOfBoardCard players={players} />);
    expect(screen.getByText("Top of the board")).toBeInTheDocument();
    expect(screen.getByText("Season 1")).toBeInTheDocument();
  });

  test("renders one row per player with rank", () => {
    render(<TopOfBoardCard players={players} />);
    const rows = screen.getAllByTestId("top-of-board-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2")).toBeInTheDocument();
    expect(within(rows[2]).getByText("3")).toBeInTheDocument();
  });

  test("rows show display name and rating", () => {
    render(<TopOfBoardCard players={players} />);
    expect(screen.getByText("Hallgrímur")).toBeInTheDocument();
    expect(screen.getByText("2,014")).toBeInTheDocument();
    expect(screen.getByText("1,930")).toBeInTheDocument();
  });

  test("empty list shows a placeholder", () => {
    render(<TopOfBoardCard players={[]} />);
    expect(screen.getByText(/Nobody on the leaderboard/i)).toBeInTheDocument();
  });
});
