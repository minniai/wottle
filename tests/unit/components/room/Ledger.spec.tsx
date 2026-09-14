import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { EMPTY_TERRITORY, emptyRows, type LedgerModel } from "@/lib/room/ledgerTypes";

const model: LedgerModel = {
  caption: "ranked · round 4 of 10",
  rows: emptyRows().map((r) => (r.round === 4 ? { ...r, status: "live", liveText: "picking · T (2)" } : r)),
  territory: { you: 32, opp: 25, free: 43 },
  hint: "tap a second letter",
};

describe("Ledger (design system §5.4)", () => {
  it("future round numerals are decorative (aria-hidden) and word cells carry their seat (T099)", () => {
    const withWords: LedgerModel = {
      ...model,
      rows: model.rows.map((r) =>
        r.round === 1
          ? {
              ...r,
              status: "past",
              you: { words: [{ word: "BORÐ", points: 12, isDuplicate: false, coordinates: [], direction: "ltr" }], total: 12 },
              opp: { words: [{ word: "GILT", points: 9, isDuplicate: false, coordinates: [], direction: "ltr" }], total: 9 },
            }
          : r,
      ),
    };
    render(<Ledger variant="match" model={withWords} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-row-7").querySelector(".ledger__round")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("ledger-row-1").querySelector(".ledger__round")).not.toHaveAttribute("aria-hidden");
    expect(screen.getByTestId("ledger-row-1").querySelector('.ledger__words[data-seat="opp"]')).toHaveTextContent("GILT");
    expect(screen.getByTestId("ledger-row-1").querySelector('.ledger__words[data-seat="you"]')).toHaveTextContent("BORÐ");
  });

  it("caption shows the lowercase wordmark and the match context", () => {
    render(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-caption")).toHaveTextContent("wottle");
    expect(screen.getByTestId("ledger-caption")).toHaveTextContent("ranked · round 4 of 10");
  });

  it("match variant renders the seat header, ten rows, a live row and territory", () => {
    render(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-header")).toHaveTextContent("Birna · you");
    expect(screen.getByTestId("ledger-header")).toHaveTextContent("Kári");
    for (let r = 1; r <= 10; r += 1) expect(screen.getByTestId(`ledger-row-${r}`)).toBeInTheDocument();
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("picking · T (2)");
    expect(screen.getByTestId("ledger-live-row")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("ledger-territory")).toHaveAttribute("aria-label", "territory 32–25");
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("tap a second letter");
  });

  it("foot has ? rules and the ⋯ menu; menu items dispatch actions", () => {
    const onAction = vi.fn();
    render(<Ledger variant="match" model={model} viewerName="B" opponentName="K" onAction={onAction} />);
    fireEvent.click(screen.getByTestId("ledger-rules"));
    expect(onAction).toHaveBeenCalledWith("rules");
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    expect(screen.getByTestId("ledger-menu-item-resign")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-menu-item-leave")).toBeInTheDocument();
    expect(screen.queryByTestId("ledger-menu-item-signout")).toBeNull();
    fireEvent.click(screen.getByTestId("ledger-menu-item-resign"));
    expect(onAction).toHaveBeenCalledWith("resign");
  });

  it("lobby variant swaps the table for a body and offers sign out", () => {
    render(<Ledger variant="lobby" model={{ caption: "lobby · 4 here", rows: [], territory: EMPTY_TERRITORY, hint: "x" }} viewerName="B" opponentName={null} body={<div data-testid="lobby-body" />} onAction={() => {}} />);
    expect(screen.getByTestId("lobby-body")).toBeInTheDocument();
    expect(screen.queryByTestId("ledger-header")).toBeNull();
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    expect(screen.getByTestId("ledger-menu-item-signout")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-menu-item-profile")).toBeInTheDocument();
  });

  it("notices render as live-row-styled lines, never dialogs", () => {
    render(<Ledger variant="match" model={model} viewerName="B" opponentName="K" notices={[{ kind: "text", text: "Kári asks for a rematch · accept ▸ · decline" }]} onAction={() => {}} />);
    expect(screen.getByTestId("ledger-notice")).toHaveTextContent("asks for a rematch");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("verdict block is announced assertively", () => {
    render(<Ledger variant="final" model={{ ...model, verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points · 10 words to 8 · territory 32–25" } }} viewerName="B" opponentName="K" onAction={() => {}} />);
    expect(screen.getByTestId("verdict")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByTestId("verdict")).toHaveTextContent("Kári wins 170–127");
  });
});
