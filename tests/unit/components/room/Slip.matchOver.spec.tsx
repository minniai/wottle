import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";
import type { SlipState } from "@/lib/room/slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

const OVER: Extract<SlipState, { kind: "matchOver" }> = {
  kind: "matchOver",
  verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points · 10 words to 8 · territory 32–25" },
  rounds: 10,
  durationMmSs: "18:50",
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

describe("Slip · match over (spec 048 US1)", () => {
  it("states the result once: label, winner in their seat, score in both inks, detail, both ratings", () => {
    render(<Slip slip={OVER} onAction={() => {}} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("match over · 10 rounds · 18:50");
    expect(screen.getByRole("heading")).toHaveTextContent("Kári wins");
    expect(screen.getByRole("heading")).toHaveAttribute("data-seat", "opp");
    const score = screen.getByTestId("slip-score");
    expect(score).toHaveTextContent("170 – 127");
    expect(score.querySelector('[data-seat="opp"]')).toHaveTextContent("170");
    expect(score.querySelector('[data-seat="you"]')).toHaveTextContent("127");
    expect(slip).toHaveTextContent("by 43 points · 10 words to 8 · territory 32–25");
    expect(screen.getByTestId("slip-ratings")).toHaveTextContent("Kári1187 → 1199 · +12Birna · you1204 → 1192 · −12");
  });

  it("offers rematch ▸ (primary), new opponent ▸, review the field ▸ and lobby", () => {
    const onAction = vi.fn();
    render(<Slip slip={OVER} onAction={onAction} />);
    expect(document.activeElement).toBe(screen.getByTestId("slip-rematch"));
    fireEvent.click(screen.getByTestId("slip-new-opponent"));
    fireEvent.click(screen.getByTestId("slip-review-field"));
    fireEvent.click(screen.getByTestId("slip-lobby"));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["newOpponent", "reviewField", "lobby"]);
  });

  it("a draw is stated in ink; the label counts the match and says nothing of why it ended", () => {
    render(<Slip slip={{ ...OVER, verdict: { winnerSeat: null, scoreLine: "draw 140–140", detailLine: "" }, scores: { you: 140, opp: 140 } }} onAction={() => {}} />);
    expect(screen.getByRole("heading")).toHaveTextContent("draw");
    expect(screen.getByRole("heading")).not.toHaveAttribute("data-seat");
    // Why it ended is the verdict's detail line, never repeated in the label (§1.9).
    expect(screen.getByTestId("slip")).toHaveTextContent("match over · 10 rounds · 18:50");
    expect(screen.getByTestId("slip")).not.toHaveTextContent("· resigned");
  });

  it("an incoming rematch rewrites the action line; waiting says so; read-only offers lobby only", () => {
    const { rerender } = render(<Slip slip={{ ...OVER, rematch: "incoming" }} onAction={() => {}} />);
    expect(screen.getByTestId("slip-rematch-incoming")).toHaveTextContent("Kári asks for a rematch");
    expect(screen.getByTestId("slip-accept-rematch")).toBeInTheDocument();
    rerender(<Slip slip={{ ...OVER, rematch: "waiting" }} onAction={() => {}} />);
    expect(screen.getByTestId("slip-rematch-waiting")).toHaveTextContent("waiting for Kári");
    rerender(<Slip slip={{ ...OVER, readOnly: true }} onAction={() => {}} />);
    expect(screen.queryByTestId("slip-rematch")).toBeNull();
    expect(screen.getByTestId("slip-lobby")).toBeInTheDocument();
  });
});
