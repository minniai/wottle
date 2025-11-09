import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BoardGrid } from "../../../../components/game/BoardGrid";
import type { BoardGrid as BoardGridType } from "../../../../lib/types/board";

function createGrid(): BoardGridType {
  return Array.from({ length: 16 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) =>
      String.fromCharCode("A".charCodeAt(0) + ((row + col) % 26))
    )
  );
}

describe("BoardGrid component", () => {
  test("renders a 16×16 grid with accessible roles", () => {
    const grid = createGrid();

    render(<BoardGrid grid={grid} />);

    const gridElement = screen.getByRole("grid", { name: /board grid/i });
    expect(gridElement).toBeInTheDocument();
    expect(gridElement).toHaveAttribute("aria-rowcount", "16");
    expect(gridElement).toHaveAttribute("aria-colcount", "16");

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(16);

    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(256);
    expect(cells[0]).toHaveTextContent(grid[0][0]);
    expect(cells.at(-1)).toHaveTextContent(grid[15][15]);
  });

  test("annotates each row and cell with coordinate metadata", () => {
    const grid = createGrid();

    render(<BoardGrid grid={grid} />);

    const rows = screen.getAllByRole("row");
    rows.forEach((row, rowIndex) => {
      expect(row).toHaveAttribute("aria-rowindex", `${rowIndex + 1}`);

      const cells = within(row).getAllByRole("gridcell");
      expect(cells).toHaveLength(16);
      cells.forEach((cell, colIndex) => {
        expect(cell).toHaveAttribute("aria-colindex", `${colIndex + 1}`);
        expect(cell).toHaveTextContent(grid[rowIndex][colIndex]);
      });
    });
  });
});


