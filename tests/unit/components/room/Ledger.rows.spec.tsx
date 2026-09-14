import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { countLines } from "@/components/room/hooks/useMeasuredLines";
import { buildLedgerRows } from "@/lib/room/ledgerRows";
import type { LedgerModel } from "@/lib/room/ledgerTypes";

const A = "a";
const words = Array.from({ length: 5 }, (_, r) => ({ roundNumber: r + 1, playerId: A, word: `orð${r + 1}`, totalPoints: 10 + r, coordinates: [{ x: r, y: 0 }, { x: r + 1, y: 0 }] }));
const rows = buildLedgerRows({ currentRound: 6, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "played" } });
const model: LedgerModel = { caption: "ranked · round 6 of 10", rows, territory: { you: 10, opp: 5, free: 85 }, hint: "tap a second letter" };

describe("Ledger rows (design system §5.4)", () => {
  it("hovering a row reveals per-word points and reports the round", () => {
    const onRowHover = vi.fn();
    render(<Ledger variant="match" model={model} viewerName="B" opponentName="K" onRowHover={onRowHover} onAction={() => {}} />);
    const row = screen.getByTestId("ledger-row-2");
    expect(row.querySelector(".ledger__points")).toBeNull();
    fireEvent.mouseEnter(row);
    expect(onRowHover).toHaveBeenCalledWith(2);
    expect(row.querySelector(".ledger__points")).toHaveTextContent("11");
    fireEvent.mouseLeave(row);
    expect(onRowHover).toHaveBeenCalledWith(null);
    expect(row.querySelector(".ledger__points")).toBeNull();
  });

  it("future rows show only their label; the live row carries the state text", () => {
    render(<Ledger variant="match" model={model} viewerName="B" opponentName="K" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-row-8")).toHaveTextContent("R8");
    expect(screen.getByTestId("ledger-row-8").querySelectorAll(".ledger__words")[0]).toBeEmptyDOMElement();
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("played ●");
  });

  it("folds rounds older than the last three to totals when a row overflows three lines", () => {
    const tall = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.textContent?.includes("orð5") ? 80 : 16;
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({ lineHeight: "16px" }) as CSSStyleDeclaration);
    render(<Ledger variant="match" model={model} viewerName="B" opponentName="K" onAction={() => {}} />);
    expect(screen.getByTestId("ledger-row-1")).toHaveAttribute("data-folded", "true");
    expect(screen.getByTestId("ledger-row-2")).toHaveAttribute("data-folded", "true");
    expect(screen.getByTestId("ledger-row-3")).not.toHaveAttribute("data-folded");
    expect(screen.getByTestId("ledger-row-1")).toHaveTextContent("10");
    expect(screen.getByTestId("ledger-row-1")).not.toHaveTextContent("orð1");
    tall.mockRestore();
    vi.restoreAllMocks();
  });

  it("countLines divides rendered height by line-height", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetHeight", { value: 48 });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ lineHeight: "16px" } as CSSStyleDeclaration);
    expect(countLines(el)).toBe(3);
    vi.restoreAllMocks();
  });
});
