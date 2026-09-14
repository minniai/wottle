import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Field } from "@/components/room/Field";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";

const V = LETTER_SCORING_VALUES_IS as Record<string, number>;

function board(): string[][] {
  const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
  grid[7][5] = "T"; // row 8, column F
  return grid;
}

describe("Field (design system §5.1, §9)", () => {
  it("renders 100 gridcells with coordinate + letter + value + state labels", () => {
    render(<Field board={board()} viewerSlot="player_a" />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(100);
    const t = cells.find((c) => c.getAttribute("data-x") === "5" && c.getAttribute("data-y") === "7")!;
    expect(t).toHaveAttribute("aria-label", `row 8, column F, T, value ${V.T}, free`);
    expect(t.querySelector(".field__value")).toHaveTextContent(String(V.T));
    expect(t).toHaveAttribute("data-state", "free");
  });

  it("frozen cells carry the scorer's seat, are aria-disabled, and still report taps (the reducer shakes them)", () => {
    const onActivate = vi.fn();
    render(
      <Field
        board={board()}
        viewerSlot="player_a"
        frozenTiles={{ "0,0": { owner: "player_b" }, "1,0": { owner: "player_a" } }}
        ownerNames={{ player_b: "Kári", player_a: "Birna" }}
        onActivate={onActivate}
      />,
    );
    const opp = screen.getAllByRole("gridcell")[0];
    expect(opp).toHaveAttribute("data-state", "frozen");
    expect(opp).toHaveAttribute("data-seat", "opp");
    expect(opp).toHaveAttribute("aria-label", `row 1, column A, A, value ${V.A}, frozen by Kári`);
    expect(opp.style.getPropertyValue("--seat-ink")).toBe("var(--opp)");
    expect(screen.getAllByRole("gridcell")[1]).toHaveAttribute("data-seat", "you");
    expect(opp).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(opp);
    expect(onActivate).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  it("free cells activate with their coordinate; disabled fields do not", () => {
    const onActivate = vi.fn();
    const { rerender } = render(<Field board={board()} viewerSlot="player_a" onActivate={onActivate} />);
    fireEvent.click(screen.getAllByRole("gridcell")[12]);
    expect(onActivate).toHaveBeenCalledWith({ x: 2, y: 1 });
    rerender(<Field board={board()} viewerSlot="player_a" onActivate={onActivate} disabled />);
    fireEvent.click(screen.getAllByRole("gridcell")[12]);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
  });

  it("read-only viewer colours player A as you and player B as opp", () => {
    render(<Field board={board()} viewerSlot={null} frozenTiles={{ "0,0": { owner: "player_a" }, "1,0": { owner: "player_b" } }} />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells[0]).toHaveAttribute("data-seat", "you");
    expect(cells[1]).toHaveAttribute("data-seat", "opp");
  });

  it("shared cells render in ink without a seat", () => {
    render(<Field board={board()} viewerSlot="player_a" frozenTiles={{ "0,0": { owner: "player_a" } }} sharedCells={new Set(["0,0"])} />);
    const cell = screen.getAllByRole("gridcell")[0];
    expect(cell).toHaveAttribute("data-state", "shared");
    expect(cell).not.toHaveAttribute("data-seat");
  });

  it("cells inside a band take the scorer's seat and render as scored; the bands SVG sits under the cells", () => {
    render(
      <Field
        board={board()}
        viewerSlot="player_a"
        frozenTiles={{ "1,2": { owner: "player_b" }, "2,2": { owner: "player_b" } }}
        bands={[{ id: "b", seat: "opp", cells: [{ x: 1, y: 2 }, { x: 2, y: 2 }], direction: "ltr", strength: "settled", round: 1, word: "ab" }]}
      />,
    );
    const field = screen.getByTestId("field");
    expect(field.firstElementChild).toBe(screen.getByTestId("field-bands"));
    const scored = screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === "1" && c.getAttribute("data-y") === "2")!;
    expect(scored).toHaveAttribute("data-state", "scored");
    expect(scored).toHaveAttribute("data-seat", "opp");
    expect(screen.getAllByTestId("field-band")).toHaveLength(1);
  });
});
