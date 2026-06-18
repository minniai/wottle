import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";

const grid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

/**
 * US2 (spec 043) — the "move submitted, waiting for opponent" state no longer
 * greys out the board. It surfaces a calm frame (via `board-grid--locked`) plus
 * the waiting banner, and continues to block clicks.
 */
describe("BoardGrid waiting state (US2, FR-001/002/003)", () => {
  it("applies the board-grid--locked container class when disabled", () => {
    render(<BoardGrid grid={grid} matchId="m-1" disabled playerSlot="player_a" />);
    expect(screen.getByTestId("board-grid").className).toContain("board-grid--locked");
  });

  it("renders the waiting banner when showLockBanner is true", () => {
    render(
      <BoardGrid grid={grid} matchId="m-1" disabled showLockBanner playerSlot="player_a" />,
    );
    const banner = screen.getByTestId("move-lock-banner");
    expect(banner.textContent ?? "").toMatch(/waiting for opponent/i);
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });

  it("does not render the banner when showLockBanner is false", () => {
    render(<BoardGrid grid={grid} matchId="m-1" disabled playerSlot="player_a" />);
    expect(screen.queryByTestId("move-lock-banner")).toBeNull();
  });

  it("blocks tile clicks from submitting a move while disabled", () => {
    const onSwapComplete = vi.fn();
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        disabled
        playerSlot="player_a"
        onSwapComplete={onSwapComplete}
      />,
    );
    const tiles = screen.getAllByTestId("board-tile");
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);
    expect(onSwapComplete).not.toHaveBeenCalled();
  });
});
