import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";
import type { SlipState } from "@/lib/room/slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

const RESIGN: SlipState = { kind: "resign", move: 4, clockMs: 192_000, opponentName: "Kári" };
const CLAIM: SlipState = { kind: "endEarly", opponentName: "Kári", opponentMoves: 8, clockMs: 72_000 };
const OVER: SlipState = {
  kind: "matchOver",
  verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points · 10 words to 8 · territory 32–25" },
  durationMmSs: "4:52",
  scores: { you: 127, opp: 170 },
  viewerName: "Birna",
  opponentName: "Kári",
  ratings: [
    { seat: "opp", name: "Kári", line: "1187 → 1199 · +12" },
    { seat: "you", name: "Birna · you", line: "1204 → 1192 · −12" },
  ],
  rematch: "idle",
  readOnly: false,
};

describe("Slip shell (spec 048 contracts/slip.md)", () => {
  it("is a modal dialog that never cancels a pick", () => {
    render(<Slip slip={RESIGN} onAction={() => {}} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveAttribute("role", "dialog");
    expect(slip).toHaveAttribute("aria-modal", "true");
    expect(slip).toHaveAttribute("data-kind", "resign");
    expect(slip).toHaveAttribute("data-field-safe");
    expect(slip).toHaveAttribute("aria-labelledby", screen.getByRole("heading").id);
  });

  it("announces the headline once, assertively", () => {
    render(<Slip slip={CLAIM} onAction={() => {}} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "assertive");
    expect(status).toHaveTextContent("Kári is gone");
  });

  it("focuses the primary action on mount (the safe one on resign, spec 068) and restores focus on unmount", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    const { unmount } = render(<Slip slip={RESIGN} onAction={() => {}} />);
    expect(document.activeElement).toBe(screen.getByTestId("slip-keep-playing"));
    unmount();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it.each([
    [RESIGN, "keepPlaying"],
    [CLAIM, "keepWaiting"],
    [OVER, "reviewField"],
  ])("Escape is the cancel of %o", (slip, expected) => {
    const onAction = vi.fn();
    render(<Slip slip={slip} onAction={onAction} />);
    fireEvent.keyDown(screen.getByTestId("slip"), { key: "Escape" });
    expect(onAction).toHaveBeenCalledWith(expected);
  });

});
