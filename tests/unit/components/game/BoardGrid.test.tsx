import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";
import type { BoardGrid as BoardGridType, Coordinate } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import {
  BOARD_SIZE,
  BOARD_TILE_COUNT,
} from "@/lib/constants/board";
import {
  PLAYER_A_OVERLAY,
  PLAYER_B_OVERLAY,
  BOTH_GRADIENT,
  PLAYER_A_HIGHLIGHT,
  PLAYER_B_HIGHLIGHT,
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

    // Fire transitionend with propertyName=transform to trigger cleanup
    await act(async () => {
      fireEvent.transitionEnd(tiles[0], { propertyName: "transform" });
      // Flush the fallback timeout and allow fetch promise to resolve
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(gridEl).not.toHaveAttribute("data-animating");
  });

  test("swap animation uses FLIP transforms (not top/left)", () => {
    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");
    // Click (0,0) then (1,0) — tiles are 50px apart horizontally
    act(() => { fireEvent.click(tiles[0]); });
    act(() => { fireEvent.click(tiles[1]); });

    // FLIP: tiles get animating class (transform path, not top/left)
    expect(tiles[0]).toHaveClass("board-grid__cell--animating");
    expect(tiles[1]).toHaveClass("board-grid__cell--animating");
    expect(tiles[0].style.top).toBe("");
    expect(tiles[0].style.left).toBe("");
  });
});

describe("BoardGrid invalid swap feedback (US7)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("applies invalid class to both tiles when server rejects the swap", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Tile is frozen" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");
    // Click (0,0) then (1,0) to trigger a swap
    act(() => {
      fireEvent.click(tiles[0]);
    });
    act(() => {
      fireEvent.click(tiles[1]);
    });

    // Allow animation + fetch to complete
    await act(async () => {
      fireEvent.transitionEnd(tiles[0], { propertyName: "transform" });
      await vi.advanceTimersByTimeAsync(350);
    });

    // Both tiles should have the invalid class
    expect(tiles[0]).toHaveClass("board-grid__cell--invalid");
    expect(tiles[1]).toHaveClass("board-grid__cell--invalid");
  });

  test("clears invalid class after 400ms", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Tile is frozen" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");
    act(() => {
      fireEvent.click(tiles[0]);
    });
    act(() => {
      fireEvent.click(tiles[1]);
    });

    await act(async () => {
      fireEvent.transitionEnd(tiles[0], { propertyName: "transform" });
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(tiles[0]).toHaveClass("board-grid__cell--invalid");

    // Advance past the 400ms clear timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(401);
    });

    expect(tiles[0]).not.toHaveClass("board-grid__cell--invalid");
    expect(tiles[1]).not.toHaveClass("board-grid__cell--invalid");
  });

  test("does not apply invalid class on a successful swap", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "accepted", grid: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");
    act(() => {
      fireEvent.click(tiles[0]);
    });
    act(() => {
      fireEvent.click(tiles[1]);
    });

    await act(async () => {
      fireEvent.transitionEnd(tiles[0], { propertyName: "transform" });
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(tiles[0]).not.toHaveClass("board-grid__cell--invalid");
    expect(tiles[1]).not.toHaveClass("board-grid__cell--invalid");
  });

  test("rejects locally instantly when a selected tile is frozen (US1)", async () => {
    const grid = createGrid();
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
    };
    render(<BoardGrid grid={grid} matchId="test-match-id" frozenTiles={frozenTiles} />);

    const tiles = screen.getAllByTestId("board-tile");
    act(() => {
      fireEvent.click(tiles[0]); // Tile 0,0 (frozen)
    });
    act(() => {
      fireEvent.click(tiles[1]); // Tile 1,0 (not frozen)
    });

    // Should not trigger fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    expect(fetchSpy).not.toHaveBeenCalled();
    // Both tiles should instantly get invalid class (no wait for animation/fetch)
    expect(tiles[0]).toHaveClass("board-grid__cell--invalid");
    expect(tiles[1]).toHaveClass("board-grid__cell--invalid");

    // Clear after 400ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(401);
    });
    expect(tiles[0]).not.toHaveClass("board-grid__cell--invalid");
    expect(tiles[1]).not.toHaveClass("board-grid__cell--invalid");
  });
});


// T013: rapid re-rejection must immediately show invalid class on new tile pair
describe("BoardGrid rapid re-rejection (FR-012)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("T013: when second rejection arrives before 400ms expires, new tile pair immediately has invalid class", async () => {
    // Both swap attempts are rejected (frozen tile)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Tile is frozen" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const grid = createGrid();
    render(<BoardGrid grid={grid} matchId="test-match-id" />);

    const tiles = screen.getAllByTestId("board-tile");

    // First swap rejection: tiles[0,1] — timer1 starts (fires at T≈400ms)
    act(() => { fireEvent.click(tiles[0]); });
    act(() => { fireEvent.click(tiles[1]); });
    await act(async () => {
      fireEvent.transitionEnd(tiles[0], { propertyName: "transform" });
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(tiles[0]).toHaveClass("board-grid__cell--invalid");
    expect(tiles[1]).toHaveClass("board-grid__cell--invalid");

    // Second swap rejection within the first 400ms window: tiles[2,3]
    // timer1 fires at T=400ms DURING this advance, clearing invalidTiles
    // unless it was cancelled first (the FR-012 fix with invalidTimerRef).
    act(() => { fireEvent.click(tiles[2]); });
    act(() => { fireEvent.click(tiles[3]); });
    await act(async () => {
      fireEvent.transitionEnd(tiles[2], { propertyName: "transform" });
      await vi.advanceTimersByTimeAsync(350);
    });

    // Without invalidTimerRef: timer1 fires at T=400 AFTER catch block sets [2,3]
    //   → setInvalidTiles(null) wins → tiles[2,3] lose invalid class → FAIL
    // With invalidTimerRef: timer1 cancelled before setting [2,3] → PASS
    expect(tiles[2]).toHaveClass("board-grid__cell--invalid");
    expect(tiles[3]).toHaveClass("board-grid__cell--invalid");

    // After 400ms from second rejection, tiles[2,3] clear (timer2 fires)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(401);
    });
    expect(tiles[2]).not.toHaveClass("board-grid__cell--invalid");
    expect(tiles[3]).not.toHaveClass("board-grid__cell--invalid");
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

describe("BoardGrid scored tile highlights with player colors (US7)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("tile in scoredTileHighlights with matching highlightPlayerColors receives scored class and --highlight-color CSS var", () => {
    const grid = createGrid();
    // col=2, row=3 → tileKey="2,3"
    const scoredTileHighlights: Coordinate[][] = [[{ x: 2, y: 3 }]];
    const highlightPlayerColors = { "2,3": PLAYER_A_HIGHLIGHT };

    render(
      <BoardGrid
        grid={grid}
        matchId="test-match-id"
        scoredTileHighlights={scoredTileHighlights}
        highlightPlayerColors={highlightPlayerColors}
        highlightDurationMs={800}
      />,
    );

    const tile = screen.getAllByTestId("board-tile")[3 * BOARD_SIZE + 2];
    expect(tile).toHaveClass("board-grid__cell--scored");
    expect(tile.style.getPropertyValue("--highlight-color")).toBe(PLAYER_A_HIGHLIGHT);
  });

  test("tile in scoredTileHighlights but absent from highlightPlayerColors receives scored class only (no --highlight-color)", () => {
    const grid = createGrid();
    const scoredTileHighlights: Coordinate[][] = [[{ x: 1, y: 2 }]];
    const highlightPlayerColors: Record<string, string> = {};

    render(
      <BoardGrid
        grid={grid}
        matchId="test-match-id"
        scoredTileHighlights={scoredTileHighlights}
        highlightPlayerColors={highlightPlayerColors}
        highlightDurationMs={800}
      />,
    );

    const tile = screen.getAllByTestId("board-tile")[2 * BOARD_SIZE + 1];
    expect(tile).toHaveClass("board-grid__cell--scored");
    expect(tile.style.getPropertyValue("--highlight-color")).toBe("");
  });

  test("tile not in scoredTileHighlights receives neither board-grid__cell--scored class nor --highlight-color", () => {
    const grid = createGrid();
    const scoredTileHighlights: Coordinate[][] = [[{ x: 5, y: 5 }]];
    const highlightPlayerColors = { "5,5": PLAYER_B_HIGHLIGHT };

    render(
      <BoardGrid
        grid={grid}
        matchId="test-match-id"
        scoredTileHighlights={scoredTileHighlights}
        highlightPlayerColors={highlightPlayerColors}
        highlightDurationMs={800}
      />,
    );

    // tile at col=0, row=0 — not in scoredTileHighlights
    const tile = screen.getAllByTestId("board-tile")[0];
    expect(tile).not.toHaveClass("board-grid__cell--scored");
    expect(tile.style.getPropertyValue("--highlight-color")).toBe("");
  });

  test("multiple word groups all highlight simultaneously in one render", () => {
    const grid = createGrid();
    const scoredTileHighlights: Coordinate[][] = [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }], // word 1: col=0,1 row=0
      [{ x: 5, y: 5 }, { x: 6, y: 5 }], // word 2: col=5,6 row=5
    ];
    const highlightPlayerColors = {
      "0,0": PLAYER_A_HIGHLIGHT,
      "1,0": PLAYER_A_HIGHLIGHT,
      "5,5": PLAYER_B_HIGHLIGHT,
      "6,5": PLAYER_B_HIGHLIGHT,
    };

    render(
      <BoardGrid
        grid={grid}
        matchId="test-match-id"
        scoredTileHighlights={scoredTileHighlights}
        highlightPlayerColors={highlightPlayerColors}
        highlightDurationMs={800}
      />,
    );

    const tiles = screen.getAllByTestId("board-tile");
    // word 1 tiles (Player A — blue)
    expect(tiles[0 * BOARD_SIZE + 0]).toHaveClass("board-grid__cell--scored");
    expect(tiles[0 * BOARD_SIZE + 1]).toHaveClass("board-grid__cell--scored");
    expect(tiles[0 * BOARD_SIZE + 0].style.getPropertyValue("--highlight-color")).toBe(PLAYER_A_HIGHLIGHT);
    // word 2 tiles (Player B — red)
    expect(tiles[5 * BOARD_SIZE + 5]).toHaveClass("board-grid__cell--scored");
    expect(tiles[5 * BOARD_SIZE + 6]).toHaveClass("board-grid__cell--scored");
    expect(tiles[5 * BOARD_SIZE + 5].style.getPropertyValue("--highlight-color")).toBe(PLAYER_B_HIGHLIGHT);
  });

  test("board-grid__cell--scored class is removed from all tiles after highlightDurationMs", async () => {
    const grid = createGrid();
    const scoredTileHighlights: Coordinate[][] = [[{ x: 2, y: 2 }, { x: 3, y: 2 }]];
    const highlightPlayerColors = {
      "2,2": PLAYER_A_HIGHLIGHT,
      "3,2": PLAYER_A_HIGHLIGHT,
    };

    render(
      <BoardGrid
        grid={grid}
        matchId="test-match-id"
        scoredTileHighlights={scoredTileHighlights}
        highlightPlayerColors={highlightPlayerColors}
        highlightDurationMs={800}
      />,
    );

    const tiles = screen.getAllByTestId("board-tile");
    const tile1 = tiles[2 * BOARD_SIZE + 2];
    const tile2 = tiles[2 * BOARD_SIZE + 3];
    expect(tile1).toHaveClass("board-grid__cell--scored");
    expect(tile2).toHaveClass("board-grid__cell--scored");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(801);
    });

    expect(tile1).not.toHaveClass("board-grid__cell--scored");
    expect(tile2).not.toHaveClass("board-grid__cell--scored");
  });
});


