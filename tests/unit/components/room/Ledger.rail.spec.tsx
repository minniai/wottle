import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { buildLedgerRows, buildMatchLedger } from "@/lib/room/ledgerRows";
import { EMPTY_TERRITORY, type LedgerModel } from "@/lib/room/ledgerTypes";

const rows = buildLedgerRows({ movesPlayed: { you: 3, opp: 6 }, completed: false, words: [], playerAId: "a", viewerSlot: "player_a", live: { kind: "idle" } });
const base: LedgerModel = { caption: "", completed: false, rows, territory: EMPTY_TERRITORY, hint: "" };

/**
 * 2026-09-21: the ledger is the match's. The move rail counted only the
 * viewer's moves and repeated the bottom bar's lane, so it is gone, and the
 * caption no longer names the viewer's move.
 */
describe("Ledger without the move rail", () => {
  it.each(["match", "final", "queue"] as const)("the %s ledger draws no rail", (variant) => {
    render(<Ledger variant={variant} model={base} viewerName="Birna" opponentName="Kári" onAction={() => {}} />);
    expect(screen.queryByTestId("move-rail")).toBeNull();
    expect(document.querySelector(".rail")).toBeNull();
  });

  it("a match's caption carries no move of the viewer's; the final one keeps the duration", () => {
    const live = buildMatchLedger({ movesPlayed: { you: 3, opp: 6 }, completed: false, words: [], playerAId: "a", viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {}, clockMs: 192_000 });
    expect(live.caption).toBe("");
    expect("movesPlayed" in live).toBe(false);
  });
});
