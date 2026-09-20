import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { EMPTY_TERRITORY, emptyRows, type LedgerModel } from "@/lib/room/ledgerTypes";

const model: LedgerModel = {
  caption: "ranked · round 4 of 10",
  rows: emptyRows().map((r) => (r.round === 4 ? { ...r, status: "live", live: { line1: "picking · T (2)", line2: "tap a second letter" } } : r)),
  territory: { you: 32, opp: 25, free: 43 },
  hint: "",
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

  it("queue variant prints its progress in a live row, not the plain hint (spec 045 B7)", () => {
    const queue = { ...model, rows: [], live: "setting the field · 58 of 100 letters", hint: "ranked · 0:07 · cancel ▸" };
    render(<Ledger variant="queue" model={queue} viewerName="Birna" opponentName={null} onAction={() => {}} />);
    const live = screen.getByTestId("ledger-live-row");
    expect(live).toHaveTextContent("setting the field · 58 of 100 letters");
    // Above the hint, which keeps its own line.
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("ranked · 0:07 · cancel ▸");
    expect(live.compareDocumentPosition(screen.getByTestId("ledger-hint")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    // Spec 047 FR-008 (review S3, S6): the row itself is the tinted grid item
    // with the rule at its left edge; nothing nested, no inline grid placement.
    const row = screen.getByTestId("ledger-row-4");
    expect(row).toHaveAttribute("data-status", "live");
    expect(row.style.gridColumn).toBe("");
    expect(row.querySelector(".ledger__live-row")).toBeNull();
    expect(row.querySelector('[data-testid="ledger-live-round"]')).toHaveTextContent("R4");
    expect(screen.queryAllByText("R4")).toHaveLength(1);
    // Amendment P1: the state on line 1, the instruction beneath it.
    const live = screen.getByTestId("ledger-live-row");
    expect(live.querySelector(".ledger__live-line1")).toHaveTextContent("picking · T (2)");
    expect(live.querySelector(".ledger__live-line2")).toHaveTextContent("tap a second letter");
    expect(screen.getByTestId("ledger-territory")).toHaveAttribute("aria-label", "territory 32–25");
    expect(screen.getByTestId("ledger-territory")).toHaveAttribute("role", "img"); // aria-label needs a role (axe aria-prohibited-attr)
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("");
  });

  it("a one-line live state renders no second line", () => {
    const idle = { ...model, rows: model.rows.map((r) => (r.round === 4 ? { ...r, live: { line1: "pick a letter", line2: "" } } : r)) };
    render(<Ledger variant="match" model={idle} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("pick a letter");
    expect(screen.getByTestId("ledger-live-row").querySelector(".ledger__live-line2")).toBeNull();
  });

  it("foot has no rules link in a match; the ⋯ menu offers how to play in a new tab and dispatches actions", () => {
    const onAction = vi.fn();
    render(<Ledger variant="match" model={model} viewerName="B" opponentName="K" onAction={onAction} />);
    expect(screen.queryByTestId("ledger-rules")).toBeNull();
    expect(screen.queryByTestId("ledger-how-to-play")).toBeNull();
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    const howTo = screen.getByTestId("ledger-menu-item-howToPlay");
    expect(howTo).toHaveAttribute("href", "/rules");
    expect(howTo).toHaveAttribute("target", "_blank");
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

  /**
   * Spec 045 US4 (FR-018 to FR-020), Fig. 5. Below 900px the ledger shows only
   * what a player needs at a glance; the rest opens from the live row, in flow
   * beneath it, so nothing is ever placed over the field.
   */
  describe("collapsed, on a phone", () => {
    const collapsed = () =>
      render(<Ledger variant="match" collapsed model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);

    it("shows the caption, the live row and territory, and nothing else", () => {
      collapsed();
      expect(screen.getByTestId("ledger-caption")).toBeInTheDocument();
      expect(screen.getByTestId("ledger-live-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("ledger-territory")).toBeInTheDocument();

      expect(screen.queryByTestId("ledger-header")).toBeNull();
      expect(screen.queryByTestId("ledger-rows")).toBeNull();
      expect(screen.queryByTestId("ledger-hint")).toBeNull();
      expect(screen.queryByTestId("ledger-foot")).toBeNull();
    });

    it("offers the history from the live row itself", () => {
      collapsed();
      const trigger = screen.getByTestId("ledger-live-trigger");
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveTextContent("history ▸");
      expect(trigger).toHaveTextContent("picking · T (2)");
      // Both lines travel to the phone: the instruction is not desktop-only.
      expect(trigger.querySelector(".ledger__live-line2")).toHaveTextContent("tap a second letter");
    });

    it("opens the rounds, notices and foot beneath the live row", () => {
      collapsed();
      fireEvent.click(screen.getByTestId("ledger-live-trigger"));
      const sheet = screen.getByTestId("ledger-sheet");
      expect(screen.getByTestId("ledger-live-trigger")).toHaveAttribute("aria-expanded", "true");
      expect(sheet.querySelector('[data-testid="ledger-header"]')).not.toBeNull();
      expect(sheet.querySelector('[data-testid="ledger-rows"]')).not.toBeNull();
      expect(sheet.querySelector('[data-testid="ledger-foot"]')).not.toBeNull();
    });

    it("closes on Escape and returns focus to the live row", () => {
      collapsed();
      const trigger = screen.getByTestId("ledger-live-trigger");
      fireEvent.click(trigger);
      fireEvent.keyDown(screen.getByTestId("ledger-sheet"), { key: "Escape" });
      expect(screen.queryByTestId("ledger-sheet")).toBeNull();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(document.activeElement).toBe(trigger);
    });

    it("does not collapse the lobby: its directory is the content, not history", () => {
      // The lobby ledger has no rounds table and no territory; folding its body
      // away would hide the here-now list behind `history ▸` with nothing left.
      render(
        <Ledger variant="lobby" collapsed model={{ ...model, rows: [] }} viewerName="Birna" opponentName={null} body={<div data-testid="lobby-body">here now</div>} onAction={() => {}} />,
      );
      expect(screen.getByTestId("lobby-body")).toBeInTheDocument();
      expect(screen.queryByTestId("ledger-live-trigger")).toBeNull();
    });

    it("forgets an open sheet when the room widens back to desktop", () => {
      const { rerender } = render(
        <Ledger variant="match" collapsed model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />,
      );
      fireEvent.click(screen.getByTestId("ledger-live-trigger"));
      expect(screen.getByTestId("ledger-sheet")).toBeInTheDocument();

      rerender(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      expect(screen.queryByTestId("ledger-sheet")).toBeNull();
      expect(screen.getByTestId("ledger-rows")).toBeInTheDocument();
    });
  });
});
