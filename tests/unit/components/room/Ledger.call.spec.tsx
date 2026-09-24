import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Ledger } from "@/components/room/Ledger";
import { copyEn } from "@/lib/i18n/copy/en";
import { ledgerCallLine } from "@/lib/room/ledgerCallLine";
import { EMPTY_TERRITORY, emptyRows, type LedgerModel } from "@/lib/room/ledgerTypes";
import type { IncomingCall } from "@/lib/types/standing";

const CALL: IncomingCall = {
  inviteId: "00000000-0000-4000-8000-000000000009",
  from: { playerId: "00000000-0000-4000-8000-000000000002", displayName: "Hekla", handle: "hekla", rating: 1250, state: "here", movesPlayed: null, record: null },
  expiresAt: "2026-09-24T12:00:47.000Z",
};

const finalModel: LedgerModel = {
  caption: "",
  rows: emptyRows(),
  territory: EMPTY_TERRITORY,
  hint: "",
  verdict: { winnerSeat: "you", scoreLine: "Birna wins 128–117", detailLine: "by 11 points" },
};

/** Spec 070 T089, game flow B6: a third party's call on the result screen, once the slip is lifted. */
describe("the ledger's call line", () => {
  it("ledgerCallLine: a call becomes the line; nothing without one", () => {
    expect(ledgerCallLine(null, CALL, copyEn)).toEqual({ kind: "call", inviteId: CALL.inviteId, text: "Hekla challenges you" });
    expect(ledgerCallLine(null, null, copyEn)).toBeNull();
  });

  it("is the ledger's line with accept ▸ and decline as secondaries", () => {
    const onAction = vi.fn();
    render(<Ledger variant="final" model={finalModel} viewerName="Birna" opponentName="Kári" notices={[ledgerCallLine(null, CALL, copyEn)!]} onAction={onAction} />);
    const line = screen.getByTestId("ledger-notice");
    expect(line).toHaveAttribute("data-kind", "call");
    expect(line).toHaveTextContent("Hekla challenges you");
    fireEvent.click(within(line).getByRole("button", { name: /accept/ }));
    fireEvent.click(within(line).getByRole("button", { name: /decline/ }));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["acceptCall", "declineCall"]);
  });
});

describe("the call line on a phone", () => {
  it("sits under the live row, not in the closed sheet", () => {
    render(<Ledger variant="final" model={finalModel} collapsed viewerName="Birna" opponentName="Kári" notices={[ledgerCallLine(null, CALL, copyEn)!]} onAction={() => {}} />);
    expect(screen.getAllByTestId("ledger-notice")).toHaveLength(1);
    expect(screen.getByTestId("ledger-call-accept")).toBeVisible();
  });

  it("an incoming rematch is the first line, with its drain, accept ▸ and decline (spec 071 T41)", () => {
    const onAction = vi.fn();
    const rematch = { kind: "rematch" as const, text: "Kári asks for a rematch · 0:24", drain: 0.8 };
    expect(ledgerCallLine(rematch, CALL, copyEn)).toBe(rematch);
    render(<Ledger variant="final" model={finalModel} viewerName="Birna" opponentName="Kári" notices={[rematch]} onAction={onAction} />);
    const line = screen.getByTestId("ledger-notice");
    expect(line).toHaveAttribute("data-kind", "rematch");
    expect(line).toHaveTextContent("Kári asks for a rematch · 0:24");
    fireEvent.click(within(line).getByRole("button", { name: /accept/ }));
    fireEvent.click(within(line).getByRole("button", { name: /decline/ }));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["acceptRematch", "declineRematch"]);
  });

  it("with both waiting, the rematch comes first and the call below it (spec 071 T65)", () => {
    const rematch = { kind: "rematch" as const, text: "Kári asks for a rematch · 0:24", drain: 0.8 };
    const call = ledgerCallLine(null, CALL, copyEn)!;
    render(<Ledger variant="final" model={finalModel} viewerName="Birna" opponentName="Kári" notices={[call, rematch]} onAction={() => {}} />);
    const lines = screen.getAllByTestId("ledger-notice");
    expect(lines.map((l) => l.getAttribute("data-kind"))).toEqual(["rematch", "call"]);
    expect(within(screen.getByTestId("ledger-state-line")).getAllByTestId("ledger-notice")).toHaveLength(2);
  });
});

