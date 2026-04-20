import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/game/BoardGrid", () => ({
  BoardGrid: () => <div data-testid="board-grid-stub" />,
}));

import { Board } from "@/components/game/Board";

const emptyGrid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

describe("Board composition", () => {
  test("wraps BoardGrid with BoardCoordLabels", () => {
    render(<Board initialGrid={emptyGrid} matchId="m-1" />);
    expect(screen.getByTestId("board-coords-top")).toBeInTheDocument();
    expect(screen.getByTestId("board-coords-left")).toBeInTheDocument();
    expect(screen.getByTestId("board-grid-stub")).toBeInTheDocument();
  });
});
