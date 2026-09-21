import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { buildLedgerRows } from "@/lib/room/ledgerRows";
import { EMPTY_TERRITORY, type LedgerModel } from "@/lib/room/ledgerTypes";

const rows = buildLedgerRows({ movesPlayed: { you: 3, opp: 6 }, completed: false, words: [], playerAId: "a", viewerSlot: "player_a", live: { kind: "idle" } });
const base: LedgerModel = { caption: "move 4 of 10", movesPlayed: 3, completed: false, rows, territory: EMPTY_TERRITORY, hint: "" };

describe("Ledger rail (spec 048 US3)", () => {
  it("match and final render the rail directly after the caption", () => {
    render(<Ledger variant="match" model={base} viewerName="B" opponentName="K" onAction={() => {}} />);
    const caption = screen.getByTestId("ledger-caption");
    expect(caption.nextElementSibling).toBe(screen.getByTestId("move-rail"));
    expect(screen.getByTestId("move-rail")).toHaveAttribute("aria-label", "move 4 of 10");
  });
  it("final fills every cell", () => {
    render(<Ledger variant="final" model={{ ...base, movesPlayed: 10, completed: true }} viewerName="B" opponentName="K" onAction={() => {}} />);
    expect(screen.getByTestId("move-rail").querySelectorAll('[data-state="past"]')).toHaveLength(10);
  });
  it("the queue shows ten future cells; the lobby shows none", () => {
    const { unmount } = render(<Ledger variant="queue" model={{ caption: "10 moves each", rows: [], territory: EMPTY_TERRITORY, hint: "" }} viewerName="B" opponentName={null} body={<span />} onAction={() => {}} />);
    expect(screen.getByTestId("move-rail").querySelectorAll('[data-state="future"]')).toHaveLength(10);
    unmount();
    render(<Ledger variant="lobby" model={{ caption: "lobby", rows: [], territory: EMPTY_TERRITORY, hint: "" }} viewerName="B" opponentName={null} body={<span />} onAction={() => {}} />);
    expect(screen.queryByTestId("move-rail")).toBeNull();
  });
  it("collapsed on a phone, the rail sits between the caption and the live-row trigger", () => {
    render(<Ledger variant="match" collapsed model={base} viewerName="B" opponentName="K" onAction={() => {}} />);
    const rail = screen.getByTestId("move-rail");
    expect(rail.previousElementSibling).toBe(screen.getByTestId("ledger-caption"));
    expect(rail.nextElementSibling).toBe(screen.getByTestId("ledger-live-trigger"));
  });
});
