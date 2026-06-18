import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";
import { PLAYER_A_HIGHLIGHT } from "@/lib/constants/playerColors";

const grid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

/** Find a tile button by its 0-based col/row. */
function tileAt(col: number, row: number): HTMLElement {
  return screen
    .getAllByTestId("board-tile")
    .find((el) => el.getAttribute("data-col") === String(col) && el.getAttribute("data-row") === String(row))!;
}

/**
 * US1 (spec 043) — tiles scored THIS round render a persistent, player-colored
 * `board-grid__cell--scored-current` mark distinct from the frozen tint, with no
 * auto-clear timer.
 */
describe("BoardGrid current-round scored mark (US1, FR-007/008/010)", () => {
  it("applies board-grid__cell--scored-current with the scoring player's color to current-round tiles", () => {
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        playerSlot="player_a"
        currentRoundScoredTiles={{ "0,0": PLAYER_A_HIGHLIGHT }}
      />,
    );

    const tile = tileAt(0, 0);
    expect(tile.className).toContain("board-grid__cell--scored-current");
    expect(tile.getAttribute("style") ?? "").toContain(PLAYER_A_HIGHLIGHT);
  });

  it("does not mark tiles that are absent from currentRoundScoredTiles", () => {
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        playerSlot="player_a"
        currentRoundScoredTiles={{ "0,0": PLAYER_A_HIGHLIGHT }}
      />,
    );

    expect(tileAt(1, 0).className).not.toContain("board-grid__cell--scored-current");
  });

  it("stacks the current-round mark with the frozen class when a tile is both", () => {
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        playerSlot="player_a"
        frozenTiles={{ "0,0": { owner: "player_a" } }}
        currentRoundScoredTiles={{ "0,0": PLAYER_A_HIGHLIGHT }}
      />,
    );

    const tile = tileAt(0, 0);
    expect(tile.className).toContain("board-grid__cell--scored-current");
    expect(tile.className).toContain("board-grid__cell--frozen");
  });

  it("keeps the mark applied across re-renders (no auto-clear timer on the prop)", () => {
    const { rerender } = render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        playerSlot="player_a"
        currentRoundScoredTiles={{ "0,0": PLAYER_A_HIGHLIGHT }}
      />,
    );
    // Re-render with the same prop — the mark must remain (parent owns clearing).
    rerender(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        playerSlot="player_a"
        currentRoundScoredTiles={{ "0,0": PLAYER_A_HIGHLIGHT }}
      />,
    );
    expect(tileAt(0, 0).className).toContain("board-grid__cell--scored-current");
  });
});
