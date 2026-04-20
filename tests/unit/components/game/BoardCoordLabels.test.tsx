import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BoardCoordLabels } from "@/components/game/BoardCoordLabels";

describe("BoardCoordLabels", () => {
  test("renders columns A through J", () => {
    render(
      <BoardCoordLabels>
        <div data-testid="inner">inner</div>
      </BoardCoordLabels>,
    );
    const cols = screen.getByTestId("board-coords-top");
    expect(within(cols).getByText("A")).toBeInTheDocument();
    expect(within(cols).getByText("J")).toBeInTheDocument();
    expect(within(cols).getAllByRole("presentation")).toHaveLength(10);
  });

  test("renders rows 1 through 10", () => {
    render(
      <BoardCoordLabels>
        <div data-testid="inner">inner</div>
      </BoardCoordLabels>,
    );
    const rows = screen.getByTestId("board-coords-left");
    expect(within(rows).getByText("1")).toBeInTheDocument();
    expect(within(rows).getByText("10")).toBeInTheDocument();
    expect(within(rows).getAllByRole("presentation")).toHaveLength(10);
  });

  test("renders the board child unchanged", () => {
    render(
      <BoardCoordLabels>
        <div data-testid="inner">inner</div>
      </BoardCoordLabels>,
    );
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  test("labels use the mono font utility", () => {
    render(
      <BoardCoordLabels>
        <div />
      </BoardCoordLabels>,
    );
    expect(screen.getByTestId("board-coords-top").className).toMatch(/font-mono/);
    expect(screen.getByTestId("board-coords-left").className).toMatch(/font-mono/);
  });
});
