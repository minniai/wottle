import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";
import type { BoardGrid as BoardGridType } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import {
  BOARD_SIZE,
  BOARD_TILE_COUNT,
} from "@/lib/constants/board";
import {
  PLAYER_A_OVERLAY,
  PLAYER_B_OVERLAY,
  BOTH_GRADIENT,
} from "@/lib/constants/playerColors";

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

describe("BoardGrid frozen tile overlays (US4)", () => {
  test("player_a frozen tile renders with blue overlay", () => {
    const grid = createGrid();
    const frozenTiles: FrozenTileMap = {
      "3,5": { owner: "player_a" },
    };

    render(
      <BoardGrid grid={grid} matchId="test-match-id" frozenTiles={frozenTiles} />,
    );

    const tile = screen.getAllByTestId("board-tile")[5 * BOARD_SIZE + 3];
    expect(tile).toHaveStyle({ backgroundColor: PLAYER_A_OVERLAY });
    expect(tile).toHaveClass("board-grid__cell--frozen");
    expect(tile).toHaveAttribute("data-frozen", "player_a");
  });

  test("player_b frozen tile renders with red overlay", () => {
    const grid = createGrid();
    const frozenTiles: FrozenTileMap = {
      "2,4": { owner: "player_b" },
    };

    render(
      <BoardGrid grid={grid} matchId="test-match-id" frozenTiles={frozenTiles} />,
    );

    const tile = screen.getAllByTestId("board-tile")[4 * BOARD_SIZE + 2];
    expect(tile).toHaveStyle({ backgroundColor: PLAYER_B_OVERLAY });
    expect(tile).toHaveAttribute("data-frozen", "player_b");
  });

  test("both-player frozen tile renders with split-diagonal gradient", () => {
    const grid = createGrid();
    const frozenTiles: FrozenTileMap = {
      "1,1": { owner: "both" },
    };

    render(
      <BoardGrid grid={grid} matchId="test-match-id" frozenTiles={frozenTiles} />,
    );

    const tile = screen.getAllByTestId("board-tile")[1 * BOARD_SIZE + 1];
    expect(tile).toHaveStyle({ background: BOTH_GRADIENT });
    expect(tile).toHaveAttribute("data-frozen", "both");
  });

  test("frozen tile letters remain visible (text content present)", () => {
    const grid = createGrid();
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
    };

    render(
      <BoardGrid grid={grid} matchId="test-match-id" frozenTiles={frozenTiles} />,
    );

    const tile = screen.getAllByTestId("board-tile")[0];
    expect(tile).toHaveTextContent(grid[0][0]);
  });

  test("frozen tile has aria-disabled", () => {
    const grid = createGrid();
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
    };

    render(
      <BoardGrid grid={grid} matchId="test-match-id" frozenTiles={frozenTiles} />,
    );

    const tile = screen.getAllByTestId("board-tile")[0];
    expect(tile).toHaveAttribute("aria-disabled", "true");
  });
});

describe("BoardGrid swap animation (US5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock getBoundingClientRect to return distinct positions
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const col = Number(this.getAttribute("data-col") ?? 0);
        const row = Number(this.getAttribute("data-row") ?? 0);
        const size = 50;
        return {
          top: row * size,
          left: col * size,
          bottom: row * size + size,
          right: col * size + size,
          width: size,
          height: size,
          x: col * size,
          y: row * size,
          toJSON: () => ({}),
        };
      },
    );
    // Mock fetch for swap submission
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "accepted", grid: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("triggering a swap sets isAnimating and blocks further tile clicks", () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");
    // Click tile (0,0) to select
    act(() => { fireEvent.click(tiles[0]); });
    // Click tile (1,0) to trigger swap animation
    act(() => { fireEvent.click(tiles[1]); });

    // Grid should be in animating state
    const gridEl = screen.getByTestId("board-grid");
    expect(gridEl).toHaveAttribute("data-animating", "true");

    // Clicking another tile during animation should be blocked
    act(() => { fireEvent.click(tiles[2]); });
    // Tile 2 should not become selected (no aria-selected)
    expect(tiles[2]).not.toHaveAttribute("aria-selected", "true");
  });

  test("transitionend clears isAnimating and tiles become clickable", async () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");
    act(() => { fireEvent.click(tiles[0]); });
    act(() => { fireEvent.click(tiles[1]); });

    const gridEl = screen.getByTestId("board-grid");
    expect(gridEl).toHaveAttribute("data-animating", "true");

    // Fire transitionend — this triggers cleanup which calls handleSwap (async fetch)
    await act(async () => {
      fireEvent.transitionEnd(tiles[0]);
      // Flush the fallback timeout and allow fetch promise to resolve
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(gridEl).not.toHaveAttribute("data-animating");
  });

  test("swap animation uses transform property (not top/left)", () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");
    // Click (0,0) then (1,0) — tiles are 50px apart horizontally
    act(() => { fireEvent.click(tiles[0]); });
    act(() => { fireEvent.click(tiles[1]); });

    // Tiles should have transform set (not top/left)
    expect(tiles[0].style.transform).toContain("translate");
    expect(tiles[1].style.transform).toContain("translate");
    expect(tiles[0].style.top).toBe("");
    expect(tiles[0].style.left).toBe("");
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


