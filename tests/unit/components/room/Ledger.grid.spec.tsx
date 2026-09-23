import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("in the final state the state's line is the verdict; the actions sit in the caption and the totals on the scoreboard", () => {
    const final: LedgerModel = { ...model, completed: true, totals: { you: 134, opp: 88 }, verdict: { scoreLine: "Birna wins 134–88", detailLine: "by 46 points", winnerSeat: "you" }, territory: EMPTY_TERRITORY };
    render(<Ledger variant="final" model={final} viewerName="Birna" opponentName="Kári" footActions={<button type="button">rematch ▸</button>} onAction={() => {}} />);
    expect(within(screen.getByTestId("ledger-state-line")).getByTestId("verdict")).toHaveTextContent("Birna wins 134–88");
    // Nothing runs past the field (spec 068 FR-013): the scoreboard's rows carry the final totals.
    expect(screen.getByTestId("ledger-caption")).toHaveTextContent("rematch ▸");
    expect(screen.queryByTestId("ledger-foot")).toBeNull();
    expect(screen.queryByTestId("ledger-totals")).toBeNull();
  });
});

describe("the live row's second line in parts (spec 068 FR-028, FR-029, FR-036)", () => {
  const withLine2 = (line2: string, line2Parts: NonNullable<LedgerModel["rows"][number]["live"]>["line2Parts"]): LedgerModel => ({
    ...model,
    rows: model.rows.map((r) => (r.move === 4 ? { ...r, live: { line1: "move 4 · your move", line2, line2Parts } } : r)),
  });

  it("draws a crimson number and a muted label for the stakes", () => {
    render(<Ledger variant="match" model={withLine2("3 moves left · −15 if unplayed", [{ text: "3 moves left · " }, { pointsLost: { value: -15, label: "if unplayed" } }])} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    const live = screen.getByTestId("ledger-live-row");
    expect(live).toHaveTextContent("3 moves left · −15if unplayed");
    expect(live.querySelector(".points-lost")).toHaveTextContent("−15");
  });

  it("draws the end-early offer as a secondary action", () => {
    const onAction = vi.fn();
    render(<Ledger variant="match" model={withLine2("Kári is gone · end the match ▸", [{ text: "Kári is gone · " }, { action: { label: "end the match ▸", action: "endEarly" } }])} viewerName="Birna" opponentName="Kári" onAction={onAction} />);
    const button = within(screen.getByTestId("ledger-live-row")).getByRole("button", { name: "end the match ▸" });
    expect(button).toHaveClass("action-secondary");
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledWith("endEarly");
  });
});

describe("notices on the grid (spec 068 FR-012, FR-013)", () => {
  it("a notice takes the state line's second line, beside the territory bar, so nothing runs past the field", () => {
    render(<Ledger variant="match" model={model} notices={[{ kind: "text", text: "realtime lost · polling" }]} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    const line = screen.getByTestId("ledger-state-line");
    expect(within(line).getByTestId("ledger-notice")).toHaveTextContent("realtime lost · polling");
    expect(within(line).getByTestId("ledger-territory")).toBeInTheDocument();
    expect(screen.getAllByTestId("ledger-notice")).toHaveLength(1);
    const rows = screen.getByTestId("ledger-rows");
    expect(rows.compareDocumentPosition(screen.getByTestId("ledger-notice")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("in the final state the verdict's score line stays and the notice takes its detail line", () => {
    const final: LedgerModel = { ...model, completed: true, verdict: { scoreLine: "Birna wins 134–88", detailLine: "by 46 points", winnerSeat: "you" } };
    render(<Ledger variant="final" model={final} notices={[{ kind: "text", text: "Kári declined" }]} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("verdict")).toHaveTextContent("Birna wins 134–88");
    expect(screen.getByTestId("verdict")).toHaveTextContent("Kári declined");
    expect(screen.getByTestId("verdict")).not.toHaveTextContent("by 46 points");
  });
});
