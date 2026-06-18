import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";
import { PLAYER_A_HIGHLIGHT } from "@/lib/constants/playerColors";

const grid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

function tileAt(col: number, row: number): HTMLElement {
  return screen
    .getAllByTestId("board-tile")
    .find((el) => el.getAttribute("data-col") === String(col) && el.getAttribute("data-row") === String(row))!;
}

/**
 * US3 (spec 043) — swapped tiles reveal, then fade if unscored; scored swapped
 * tiles promote to the current-round mark instead of fading/lifting.
 */
describe("BoardGrid swap reveal-then-fade (US3, FR-004/005/006)", () => {
  const pair: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ];

  it("renders the locked lift on a swapped tile that has not scored", () => {
    render(
      <BoardGrid grid={grid} matchId="m-1" playerSlot="player_a" lockedTiles={pair} />,
    );
    expect(tileAt(0, 0).className).toContain("board-grid__cell--locked");
  });

  it("promotes a swapped+scored tile to the current-round mark (no locked lift)", () => {
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        playerSlot="player_a"
        lockedTiles={pair}
        currentRoundScoredTiles={{ "0,0": PLAYER_A_HIGHLIGHT }}
      />,
    );
    const tile = tileAt(0, 0);
    expect(tile.className).toContain("board-grid__cell--scored-current");
    expect(tile.className).not.toContain("board-grid__cell--locked");
  });

  it("applies the swap-fade animation to an unscored fading tile", () => {
    render(
      <BoardGrid grid={grid} matchId="m-1" playerSlot="player_a" revealFadeTiles={pair} />,
    );
    expect(tileAt(0, 0).className).toContain("board-grid__cell--swap-fade");
  });

  it("does not fade a scored tile — it keeps the current-round mark", () => {
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        playerSlot="player_a"
        revealFadeTiles={pair}
        currentRoundScoredTiles={{ "0,0": PLAYER_A_HIGHLIGHT }}
      />,
    );
    const tile = tileAt(0, 0);
    expect(tile.className).toContain("board-grid__cell--scored-current");
    expect(tile.className).not.toContain("board-grid__cell--swap-fade");
  });
});
