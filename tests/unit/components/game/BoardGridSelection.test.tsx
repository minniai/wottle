import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";

const grid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

describe("BoardGrid onSelectionChange", () => {
  test("fires null initially (no change on mount) and after a pick", async () => {
    const onSelectionChange = vi.fn();
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalled();
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);

    const firstTile = screen.getAllByTestId("board-tile")[0];
    fireEvent.click(firstTile);

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith({ x: 0, y: 0 });
    });
  });
});
