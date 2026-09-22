import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { EMPTY_TERRITORY, emptyRows, type LedgerModel } from "@/lib/room/ledgerTypes";

const model: LedgerModel = {
  caption: "move 4 of 10",
  clock: "3:12",
  rows: emptyRows().map((r) => (r.move === 4 ? { ...r, status: "live", live: { line1: "picking · T (2)", line2: "tap a second letter" } } : r)),
  territory: { you: 32, opp: 25, free: 43 },
  hint: "",
};

describe("Ledger (design system §5.4)", () => {
  it("future round numerals are decorative (aria-hidden) and word cells carry their seat (T099)", () => {
    const withWords: LedgerModel = {
      ...model,
      rows: model.rows.map((r) =>
        r.move === 1
          ? {
              ...r,
              status: "past",
              you: { words: [{ word: "BORÐ", points: 12, coordinates: [], direction: "ltr" }], total: 12 },
              opp: { words: [{ word: "GILT", points: 9, coordinates: [], direction: "ltr" }], total: 9 },
            }
          : r,
      ),
    };
    render(<Ledger variant="match" model={withWords} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-row-7").querySelector(".ledger__move")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("ledger-row-1").querySelector(".ledger__move")).not.toHaveAttribute("aria-hidden");
    expect(screen.getByTestId("ledger-row-1").querySelector('.ledger__words[data-seat="opp"]')).toHaveTextContent("GILT");
    expect(screen.getByTestId("ledger-row-1").querySelector('.ledger__words[data-seat="you"]')).toHaveTextContent("BORÐ");
  });

  it("queue variant prints its progress in a live row, not the plain hint (spec 045 B7)", () => {
    const queue = { ...model, rows: [], live: "setting the field · 58 of 100 letters", hint: "searching · 0:07 · cancel ▸" };
    render(<Ledger variant="queue" model={queue} viewerName="Birna" opponentName={null} onAction={() => {}} />);
    const live = screen.getByTestId("ledger-live-row");
    expect(live).toHaveTextContent("setting the field · 58 of 100 letters");
    // Above the hint, which keeps its own line.
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("searching · 0:07 · cancel ▸");
    expect(live.compareDocumentPosition(screen.getByTestId("ledger-hint")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("caption shows the lowercase wordmark and the match context", () => {
    render(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-caption")).toHaveTextContent("wottle");
    expect(screen.getByTestId("ledger-caption")).toHaveTextContent("move 4 of 10");
    expect(screen.getByTestId("match-clock")).toHaveTextContent("3:12");
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
    // Amendment P1: the state on line 1, the instruction beneath it.
    const live = screen.getByTestId("ledger-live-row");
    expect(live.querySelector(".ledger__live-line1")).toHaveTextContent("picking · T (2)");
    expect(live.querySelector(".ledger__live-line2")).toHaveTextContent("tap a second letter");
    expect(screen.getByTestId("ledger-territory")).toHaveAttribute("aria-label", "territory 32–25");
    expect(screen.getByTestId("ledger-territory")).toHaveAttribute("role", "img"); // aria-label needs a role (axe aria-prohibited-attr)
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("");
  });

  it("a live row that holds the opponent's move shows their total only, after the live text (spec 050)", () => {
    const gilt = { word: "GILT", points: 15, coordinates: [], direction: "ttb" as const };
    const withOpp: LedgerModel = {
      ...model,
      rows: model.rows.map((r) => (r.move === 4 ? { ...r, opp: { words: [gilt], total: 15 } } : r)),
    };
    render(<Ledger variant="match" model={withOpp} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    const next = screen.getByTestId("ledger-live-row").nextElementSibling;
    expect(next).toHaveClass("ledger__words");
    expect(next).toHaveAttribute("data-seat", "opp");
    expect(next).toHaveTextContent(/^15$/);
  });

  it("a one-line live state renders no second line", () => {
    const idle = { ...model, rows: model.rows.map((r) => (r.move === 4 ? { ...r, live: { line1: "pick a letter", line2: "" } } : r)) };
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
    expect(howTo).toHaveAttribute("href", "/en/rules");
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

  describe("the ledger clock (2026-09-21)", () => {
    const at = (clock: string, clockPhase: "calm" | "low" | "flash" | "spent", clockFraction: number): LedgerModel => ({ ...model, clock, clockPhase, clockFraction });

    it("is a boxed block under the caption: a label, the time and a bar that drains; the caption no longer carries a clock", () => {
      render(<Ledger variant="match" model={at("3:12", "calm", 0.64)} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      const clock = screen.getByTestId("match-clock");
      expect(clock).toHaveAttribute("role", "timer");
      expect(clock).toHaveAttribute("aria-live", "off");
      expect(clock).toHaveAttribute("aria-label", "match clock, 3:12 left");
      expect(clock).toHaveAttribute("data-phase", "calm");
      expect(clock).toHaveTextContent("match clock");
      expect(clock.querySelector(".ledger__clock-time")).toHaveTextContent("3:12");
      expect((clock.querySelector(".ledger__clock-fill") as HTMLElement).style.getPropertyValue("--clock-fraction")).toBe("0.64");
      expect(screen.getByTestId("ledger-caption")).not.toHaveTextContent("3:12");
      expect(clock.querySelector(".ledger__clock-invert")).toBeNull();
    });

    it("in the last 15 seconds it names the seconds and adds the inverted face that flashes, hidden from AT", () => {
      render(<Ledger variant="match" model={at("0:12", "flash", 0.04)} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      const clock = screen.getByTestId("match-clock");
      expect(clock).toHaveAttribute("data-phase", "flash");
      const invert = clock.querySelector(".ledger__clock-invert")!;
      expect(invert).toHaveAttribute("aria-hidden", "true");
      expect(invert).toHaveTextContent("last 12s");
      expect(invert).toHaveTextContent("0:12");
    });

    it("at 0:00 it holds inverted and reads time", () => {
      render(<Ledger variant="match" model={at("0:00", "spent", 0)} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      const invert = screen.getByTestId("match-clock").querySelector(".ledger__clock-invert")!;
      expect(invert).toHaveTextContent("time");
    });
  });

  it("a missed move writes its penalty with a real minus; a timed-out unplayed one is marked (rules §5.6)", () => {
    const withMiss: LedgerModel = {
      ...model,
      rows: model.rows.map((r) =>
        r.move === 2 ? { ...r, status: "past", you: { words: [], total: -5, miss: true }, opp: null } : r.move === 9 ? { ...r, status: "past", you: { words: [], total: -5, miss: true, unplayed: true }, opp: null } : r,
      ),
    };
    render(<Ledger variant="final" model={withMiss} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    const miss = screen.getByTestId("ledger-row-2").querySelector('[data-seat="you"]')!;
    expect(miss).toHaveTextContent("−5");
    expect(miss).toHaveAttribute("data-miss", "true");
    const unplayed = screen.getByTestId("ledger-row-9").querySelector('[data-seat="you"]')!;
    expect(unplayed).toHaveTextContent("−5");
    expect(unplayed).toHaveAttribute("data-unplayed", "true");
  });

  // 2026-09-21: the spine. The move number sits between the two columns, your
  // moves read inward from the left and theirs from the right, and each row's
  // two scores meet at the spine.
  describe("the spine", () => {
    const played: LedgerModel = {
      ...model,
      rows: model.rows.map((r) =>
        r.move === 2
          ? { ...r, status: "past", you: { words: [{ word: "sæli", points: 12, coordinates: [], direction: "ltr" }, { word: "tói", points: 8, coordinates: [], direction: "ltr" }], total: 20 }, opp: { words: [{ word: "áta", points: 22, coordinates: [], direction: "ltr" }], total: 22 } }
          : r.move === 1
            ? { ...r, status: "past", you: { words: [], total: -5, miss: true }, opp: { words: [], total: -5, miss: true, unplayed: true } }
            : r,
      ),
    };

    it("each row is your cell, the move number, their cell, in that order; the scores meet at the spine", () => {
      render(<Ledger variant="match" model={played} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      const cells = [...screen.getByTestId("ledger-row-2").children];
      expect(cells.map((c) => c.className.split(" ")[0])).toEqual(["ledger__words", "ledger__move", "ledger__words"]);
      expect(cells[0]).toHaveAttribute("data-seat", "you");
      expect(cells[1]).toHaveTextContent(/^2$/);
      expect(cells[2]).toHaveAttribute("data-seat", "opp");
      // Your points come after your words (next to the spine); theirs come first.
      expect(cells[0].lastElementChild).toHaveClass("ledger__total");
      expect(cells[0].lastElementChild).toHaveTextContent("20");
      expect(cells[2].firstElementChild).toHaveClass("ledger__total");
      expect(cells[2].firstElementChild).toHaveTextContent("22");
    });

    it("the header faces off across the spine", () => {
      render(<Ledger variant="match" model={played} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      const header = [...screen.getByTestId("ledger-header").children];
      expect(header).toHaveLength(3);
      expect(header[0]).toHaveTextContent("Birna · you");
      expect(header[1]).toHaveTextContent("move");
      expect(header[2]).toHaveTextContent("Kári");
    });

    it("a miss says no word, a move lost to the clock says not played, each beside its −5", () => {
      render(<Ledger variant="final" model={played} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      const row = screen.getByTestId("ledger-row-1");
      expect(row.querySelector('[data-seat="you"]')).toHaveTextContent("no word−5");
      expect(row.querySelector('[data-seat="opp"]')).toHaveTextContent("−5not played");
      expect(row.querySelector('[data-seat="you"] .ledger__miss')).toBeInTheDocument();
    });

    it("the final ledger closes with a total row in the seat colours", () => {
      render(<Ledger variant="final" model={{ ...played, completed: true, totals: { you: 99, opp: 105 } }} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      const totals = screen.getByTestId("ledger-totals");
      expect([...totals.children].map((c) => c.textContent)).toEqual(["99", "total", "105"]);
    });

    it("the live row is one band across the ledger: the beat, with their total at the right", () => {
      render(<Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
      expect(screen.getByTestId("ledger-row-4").querySelector(".ledger__move")).toBeNull();
      expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("picking · T (2)");
    });
  });
});

