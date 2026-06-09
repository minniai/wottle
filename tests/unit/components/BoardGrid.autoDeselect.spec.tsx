import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";

const grid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

/**
 * US3 — Auto-deselect a tile that just got frozen (spec 042 / Linear O-57).
 *
 * Scenario: Window B has tapped tile (X,Y) but not a second tile.
 * Window A's instant-scoring reveal lands and freezes (X,Y).
 * Window B's selection MUST clear silently; an aria-live region announces.
 */
describe("BoardGrid auto-deselect on freeze (T032, FR-004, FR-005, FR-017)", () => {
  it("removes the selection ring when the selected tile becomes frozen mid-round", async () => {
    const { rerender } = render(
      <BoardGrid grid={grid} matchId="m-1" frozenTiles={{}} playerSlot="player_b" />,
    );

    const tiles = screen.getAllByTestId("board-tile");
    const firstTile = tiles[0]; // (col 0, row 0)
    fireEvent.click(firstTile);

    await waitFor(() => {
      expect(firstTile.getAttribute("data-selected")).toBe("true");
    });

    rerender(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        frozenTiles={{ "0,0": { owner: "player_a" } }}
        playerSlot="player_b"
      />,
    );

    await waitFor(() => {
      const refreshed = screen.getAllByTestId("board-tile")[0];
      expect(refreshed.getAttribute("data-selected")).toBeNull();
    });
  });

  it("populates the aria-live region with the auto-deselect announcement", async () => {
    const { rerender } = render(
      <BoardGrid grid={grid} matchId="m-1" frozenTiles={{}} playerSlot="player_b" />,
    );

    const tile = screen.getAllByTestId("board-tile")[0];
    fireEvent.click(tile);
    await waitFor(() => {
      expect(tile.getAttribute("data-selected")).toBe("true");
    });

    rerender(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        frozenTiles={{ "0,0": { owner: "player_a" } }}
        playerSlot="player_b"
      />,
    );

    await waitFor(() => {
      const live = screen.getByTestId("board-grid-autodeselect-live");
      expect(live.textContent ?? "").toMatch(/frozen|deselect|cleared/i);
    });
  });

  it("treats the next tile click as a fresh single-tile selection (not a swap completion of the prior pair)", async () => {
    const onSwapComplete = vi.fn();
    const { rerender } = render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        frozenTiles={{}}
        playerSlot="player_b"
        onSwapComplete={onSwapComplete}
      />,
    );

    const tiles = screen.getAllByTestId("board-tile");
    fireEvent.click(tiles[0]); // select (0,0)
    await waitFor(() =>
      expect(tiles[0].getAttribute("data-selected")).toBe("true"),
    );

    rerender(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        frozenTiles={{ "0,0": { owner: "player_a" } }}
        playerSlot="player_b"
        onSwapComplete={onSwapComplete}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getAllByTestId("board-tile")[0].getAttribute("data-selected"),
      ).toBeNull();
    });

    const tile22 = screen.getAllByTestId("board-tile")[2 * 10 + 2]; // (col 2, row 2)
    fireEvent.click(tile22);

    await waitFor(() =>
      expect(tile22.getAttribute("data-selected")).toBe("true"),
    );

    expect(onSwapComplete).not.toHaveBeenCalled();
  });
});
