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
  it("grid → ten rows → ten gridcells each (ARIA structure; axe aria-required-children/parent)", () => {
    render(<Field board={board()} viewerSlot="player_a" />);
    const grid = screen.getByRole("grid");
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.parentElement).toBe(grid);
      expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(10);
    }
  });

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

  // Spec 049 US2 (contracts/ownership-rendering.md): a scored letter takes the
  // seat of the player who froze it first, whatever bands cover it. No cell is
  // ever "shared"; the aria-label names one owner.
  describe("one owner, one colour", () => {
    const crossing = { "1,2": { owner: "player_b" as const }, "2,2": { owner: "player_b" as const }, "3,2": { owner: "player_b" as const }, "2,3": { owner: "player_a" as const }, "2,4": { owner: "player_a" as const } };
    const bands = [
      { id: "opp", seat: "opp" as const, cells: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }], wordCells: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }], direction: "ltr" as const, strength: "settled" as const, move: 1, word: "aaa" },
      { id: "you", seat: "you" as const, cells: [{ x: 2, y: 3 }, { x: 2, y: 4 }], wordCells: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }], direction: "ttb" as const, strength: "settled" as const, move: 2, word: "aaa" },
    ];
    const at = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

    it("the crossing letter keeps the seat of the player who froze it first, under both bands", () => {
      render(<Field board={board()} viewerSlot="player_a" frozenTiles={crossing} ownerNames={{ player_b: "Kári", player_a: "Birna" }} bands={bands} />);
      const shared = at(2, 2);
      expect(shared).toHaveAttribute("data-state", "scored");
      expect(shared).toHaveAttribute("data-seat", "opp");
      expect(shared.style.getPropertyValue("--seat-ink")).toBe("var(--opp)");
      expect(shared).toHaveAttribute("aria-label", `row 3, column C, A, value ${V.A}, scored`);
      expect(at(2, 3)).toHaveAttribute("data-seat", "you");
      expect(screen.getAllByRole("gridcell").some((c) => c.getAttribute("data-state") === "shared")).toBe(false);
    });

    it("a letter frozen by the viewer under the opponent's band is still the viewer's", () => {
      const swapped = { ...crossing, "2,2": { owner: "player_a" as const } };
      render(<Field board={board()} viewerSlot="player_a" frozenTiles={swapped} bands={bands} />);
      expect(at(2, 2)).toHaveAttribute("data-seat", "you");
    });

    it("hovering a move draws its bands over the whole word; the lit letter keeps its owner", () => {
      render(<Field board={board()} viewerSlot="player_a" frozenTiles={crossing} bands={bands} highlightMove={2} />);
      const lit = screen.getAllByTestId("field-band").find((b) => b.getAttribute("data-move") === "2")!;
      expect(lit).toHaveAttribute("data-cells", "2,2;2,3;2,4");
      expect(at(2, 2)).toHaveAttribute("data-seat", "opp");
    });

    it("draws a settled band only over the cells its word froze first", () => {
      render(<Field board={board()} viewerSlot="player_a" frozenTiles={crossing} bands={bands} />);
      const own = screen.getAllByTestId("field-band").find((b) => b.getAttribute("data-move") === "2")!;
      expect(own).toHaveAttribute("data-cells", "2,3;2,4");
    });
  });

  it("cells inside a band take the scorer's seat and render as scored; the bands SVG sits under the cells", () => {
    render(
      <Field
        board={board()}
        viewerSlot="player_a"
        frozenTiles={{ "1,2": { owner: "player_b" }, "2,2": { owner: "player_b" } }}
        bands={[{ id: "b", seat: "opp", cells: [{ x: 1, y: 2 }, { x: 2, y: 2 }], wordCells: [{ x: 1, y: 2 }, { x: 2, y: 2 }], direction: "ltr", strength: "settled", move: 1, word: "ab" }]}
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
