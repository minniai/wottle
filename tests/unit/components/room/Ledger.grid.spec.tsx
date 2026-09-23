import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { EMPTY_TERRITORY, emptyRows, type LedgerModel } from "@/lib/room/ledgerTypes";

/** Spec 068 FR-012, FR-014: the match ledger on the scoreboard's grid. */
const model: LedgerModel = {
  caption: "",
  rows: emptyRows().map((r) => (r.move === 4 ? { ...r, status: "live", live: { line1: "move 4 · your move", line2: "pick a letter" } } : r)),
  territory: { you: 10, opp: 10, free: 80 },
  hint: "",
};

describe("Ledger on one grid (spec 068)", () => {
  it("holds no clock: the clock is the scoreboard's", () => {
    render(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.queryByTestId("match-clock")).toBeNull();
    expect(document.querySelector(".ledger__clock")).toBeNull();
  });

  it("its first three rows mirror the scoreboard's: the wordmark and ⋯, territory, the face-off header", () => {
    render(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    const head = screen.getByTestId("ledger-head");
    const rows = Array.from(head.children).map((el) => el.getAttribute("data-testid"));
    expect(rows).toEqual(["ledger-caption", "ledger-state-line", "ledger-header"]);
    expect(within(screen.getByTestId("ledger-caption")).getByTestId("ledger-menu-trigger")).toBeInTheDocument();
    expect(within(screen.getByTestId("ledger-state-line")).getByTestId("ledger-territory")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-state-line")).toHaveTextContent("10 · 80 free · 10");
  });

  it("then ten move rows, the live row one of them, and no foot during a match", () => {
    render(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-rows").children).toHaveLength(10);
    expect(screen.getByTestId("ledger-row-4")).toHaveAttribute("data-status", "live");
    expect(screen.queryByTestId("ledger-foot")).toBeNull();
    // One ⋯, in the caption.
    expect(screen.getAllByTestId("ledger-menu-trigger")).toHaveLength(1);
  });

  it("in the final state the state's line is the verdict, and the foot keeps the state's actions", () => {
    const final: LedgerModel = { ...model, completed: true, totals: { you: 134, opp: 88 }, verdict: { scoreLine: "Birna wins 134–88", detailLine: "by 46 points", winnerSeat: "you" }, territory: EMPTY_TERRITORY };
    render(<Ledger variant="final" model={final} viewerName="Birna" opponentName="Kári" footActions={<button type="button">rematch ▸</button>} onAction={() => {}} />);
    expect(within(screen.getByTestId("ledger-state-line")).getByTestId("verdict")).toHaveTextContent("Birna wins 134–88");
    expect(screen.getByTestId("ledger-foot")).toHaveTextContent("rematch ▸");
    expect(screen.getByTestId("ledger-totals")).toBeInTheDocument();
  });
});
