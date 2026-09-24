import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Ledger, type LedgerReview } from "@/components/room/Ledger";
import { EMPTY_TERRITORY, emptyRows, type LedgerModel } from "@/lib/room/ledgerTypes";

const cell = (word: string, total: number) => ({ words: [{ word, points: total }], total });
const rows = emptyRows().map((r) => ({ ...r, status: "past" as const, you: cell(`y${r.move}`, 10), opp: cell(`o${r.move}`, 12) }));
const model: LedgerModel = {
  caption: "review · 4:52",
  completed: true,
  rows,
  territory: EMPTY_TERRITORY,
  hint: "",
  verdict: { winnerSeat: "you", scoreLine: "Birna wins 134–88", detailLine: "by 46 points" },
};

function review(over: Partial<LedgerReview> = {}): LedgerReview {
  const states = new Map<string, "reached" | "current" | "ahead">();
  for (let m = 1; m <= 10; m++) {
    states.set(`player_a:${m}`, m < 3 ? "reached" : m === 3 ? "current" : "ahead");
    states.set(`player_b:${m}`, m <= 4 ? "reached" : "ahead");
  }
  return {
    viewerSlot: "player_a",
    current: { slot: "player_a", move: 3 },
    cursor: { line1: "move 3 · Birna · LEK · ÆSKU +33", line2: "froze 6 · Birna leads 51–18" },
    states,
    names: { a: "Birna", b: "Kári" },
    controls: <span data-testid="controls">controls</span>,
    onJump: vi.fn(),
    ...over,
  };
}

describe("the ledger in review (spec 071 FR-036, FR-037)", () => {
  it("puts the controls on the state line and the caption says review", () => {
    render(<Ledger variant="final" model={model} viewerName="Birna" opponentName="Kári" review={review()} onAction={() => {}} />);
    expect(within(screen.getByTestId("ledger-state-line")).getByTestId("controls")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-caption")).toHaveTextContent("review · 4:52");
  });

  it("writes the cursor line in the current move's row, in the live row's style", () => {
    render(<Ledger variant="final" model={model} viewerName="Birna" opponentName="Kári" review={review()} onAction={() => {}} />);
    const row = screen.getByTestId("ledger-row-3");
    expect(row).toHaveAttribute("data-status", "settled");
    expect(within(row).getByTestId("ledger-live-row")).toHaveTextContent("move 3 · Birna · LEK · ÆSKU +33froze 6 · Birna leads 51–18");
  });

  it("makes every other cell a way to its step, muted and named when not yet reached", () => {
    const r = review();
    render(<Ledger variant="final" model={model} viewerName="Birna" opponentName="Kári" review={r} onAction={() => {}} />);
    const ahead = screen.getByRole("gridcell", { name: "move 8, Kári, not yet reached" });
    expect(ahead).toHaveAttribute("data-review", "ahead");
    fireEvent.click(ahead);
    expect(r.onJump).toHaveBeenCalledWith("player_b", 8);
    expect(screen.getByRole("gridcell", { name: "move 2, Birna" })).toHaveAttribute("data-review", "reached");
  });

  it("is one grid with a roving tabindex: arrows move, one cell takes Tab", () => {
    render(<Ledger variant="final" model={model} viewerName="Birna" opponentName="Kári" review={review()} onAction={() => {}} />);
    const grid = screen.getByRole("grid");
    const cells = within(grid).getAllByRole("gridcell");
    expect(cells.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    const first = cells.find((c) => c.tabIndex === 0)!;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).not.toBe(first);
    expect((document.activeElement as HTMLElement).getAttribute("role")).toBe("gridcell");
  });
});
