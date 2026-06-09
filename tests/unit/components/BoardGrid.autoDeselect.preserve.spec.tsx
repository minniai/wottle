import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";

const grid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

/**
 * US3 negative — FR-005: the selection MUST be preserved when the new
 * frozenTiles do not include the selected tile. The auto-deselect effect
 * only fires for the specific tile that became frozen this render.
 */
describe("BoardGrid preserves selection when other tiles freeze (T033, FR-005)", () => {
  it("keeps the selection ring when the new freeze does NOT cover the selected tile", async () => {
    const { rerender } = render(
      <BoardGrid grid={grid} matchId="m-1" frozenTiles={{}} playerSlot="player_b" />,
    );

    const tile = screen.getAllByTestId("board-tile")[0]; // (0,0)
    fireEvent.click(tile);
    await waitFor(() =>
      expect(tile.getAttribute("data-selected")).toBe("true"),
    );

    rerender(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        frozenTiles={{
          "3,3": { owner: "player_a" },
          "4,3": { owner: "player_a" },
        }}
        playerSlot="player_b"
      />,
    );

    await waitFor(() => {
      const refreshed = screen.getAllByTestId("board-tile")[0];
      expect(refreshed.getAttribute("data-selected")).toBe("true");
    });
  });

  it("does NOT populate the aria-live region when an unrelated tile freezes", async () => {
    const { rerender } = render(
      <BoardGrid grid={grid} matchId="m-1" frozenTiles={{}} playerSlot="player_b" />,
    );

    const tile = screen.getAllByTestId("board-tile")[0];
    fireEvent.click(tile);
    await waitFor(() =>
      expect(tile.getAttribute("data-selected")).toBe("true"),
    );

    rerender(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        frozenTiles={{ "9,9": { owner: "player_a" } }}
        playerSlot="player_b"
      />,
    );

    // Give the effect a tick to settle, then assert empty
    await new Promise((r) => setTimeout(r, 50));
    const live = screen.getByTestId("board-grid-autodeselect-live");
    expect(live.textContent ?? "").toBe("");
  });
});
