import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";
import type { BoardGrid as BoardGridType } from "@/lib/types/board";
import {
  BOARD_SIZE,
  BOARD_TILE_COUNT,
} from "@/lib/constants/board";

function createGrid(): BoardGridType {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) =>
      String.fromCharCode("A".charCodeAt(0) + ((row + col) % 26))
    )
  );
}

describe("BoardGrid responsive layout (US2)", () => {
  test("grid container applies board-grid class for viewport-responsive CSS", () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const gridElement = screen.getByTestId("board-grid");
    expect(gridElement).toHaveClass("board-grid");
  });

  test("grid wrapper applies board-grid__wrapper class for aspect-ratio CSS", () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const gridElement = screen.getByTestId("board-grid");
    const wrapper = gridElement.closest(".board-grid__wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("board-grid__wrapper");
  });

  test("grid sets --board-size CSS custom property for responsive column sizing", () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const gridElement = screen.getByTestId("board-grid");
    expect(gridElement.style.getPropertyValue("--board-size")).toBe(
      `${BOARD_SIZE}`,
    );
  });

  test("cells have board-grid__cell class for min-width enforcement", () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(BOARD_TILE_COUNT);
    cells.forEach((cell) => {
      expect(cell).toHaveClass("board-grid__cell");
    });
  });
});

describe("BoardGrid component", () => {
  test(`renders a ${BOARD_SIZE}x${BOARD_SIZE} grid with accessible roles`, () => {
    const grid = createGrid();

    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const gridElement = screen.getByRole("grid", { name: /board grid/i });
    expect(gridElement).toBeInTheDocument();
    expect(gridElement).toHaveAttribute("aria-rowcount", `${BOARD_SIZE}`);
    expect(gridElement).toHaveAttribute("aria-colcount", `${BOARD_SIZE}`);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(BOARD_SIZE);

    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(BOARD_TILE_COUNT);
    expect(cells[0]).toHaveTextContent(grid[0][0]);
    expect(cells.at(-1)).toHaveTextContent(
      grid[BOARD_SIZE - 1][BOARD_SIZE - 1]
    );
  });

  test("annotates each row and cell with coordinate metadata", () => {
    const grid = createGrid();

    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const rows = screen.getAllByRole("row");
    rows.forEach((row, rowIndex) => {
      expect(row).toHaveAttribute("aria-rowindex", `${rowIndex + 1}`);

      const cells = within(row).getAllByRole("gridcell");
      expect(cells).toHaveLength(BOARD_SIZE);
      cells.forEach((cell, colIndex) => {
        expect(cell).toHaveAttribute("aria-colindex", `${colIndex + 1}`);
        expect(cell).toHaveTextContent(grid[rowIndex][colIndex]);
      });
    });
  });
});


