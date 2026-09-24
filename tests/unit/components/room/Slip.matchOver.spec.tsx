import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";
import type { SlipState } from "@/lib/room/slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

const OVER: Extract<SlipState, { kind: "matchOver" }> = {
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

describe("Slip · match over (spec 048 US1)", () => {
  it("states the result once: label, winner in their seat, score in both inks, detail, both ratings", () => {
    render(<Slip slip={OVER} onAction={() => {}} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("match over · 4:52");
    expect(screen.getByRole("heading")).toHaveTextContent("Kári wins");
    expect(screen.getByRole("heading")).toHaveAttribute("data-seat", "opp");
    const score = screen.getByTestId("slip-score");
    expect(score).toHaveTextContent("170 – 127");
    expect(score.querySelector('[data-seat="opp"]')).toHaveTextContent("170");
    expect(score.querySelector('[data-seat="you"]')).toHaveTextContent("127");
    expect(slip).toHaveTextContent("by 43 points · 10 words to 8 · territory 32–25");
    expect(screen.getByTestId("slip-ratings")).toHaveTextContent("Kári1187 → 1199 · +12Birna · you1204 → 1192 · −12");
  });

  it("focuses its headline, since the game raised it (spec 071 FR-001, design system §5.5)", () => {
    render(<Slip slip={OVER} onAction={() => {}} />);
    const headline = screen.getByRole("heading");
    expect(document.activeElement).toBe(headline);
    expect(headline).toHaveAttribute("tabindex", "-1");
  });

  describe("actions", () => {
    beforeEach(() => {
    vi.useFakeTimers();
  });
    afterEach(() => {
    vi.useRealTimers();
  });

    it("lays out rematch ▸ · new opponent ▸, then review the match ▸ · lobby", () => {
      render(<Slip slip={OVER} onAction={() => {}} />);
      const rows = screen.getAllByTestId("slip-action-row");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("rematch ▸new opponent ▸");
      expect(rows[1]).toHaveTextContent("review the match ▸lobby");
    });

    it("ignores every action for 500ms after it lands (FR-002)", () => {
      const onAction = vi.fn();
      render(<Slip slip={OVER} onAction={onAction} />);
      for (const id of ["slip-rematch", "slip-new-opponent", "slip-review-field", "slip-lobby"]) fireEvent.click(screen.getByTestId(id));
      expect(onAction).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(500));
      for (const id of ["slip-rematch", "slip-new-opponent", "slip-review-field", "slip-lobby"]) fireEvent.click(screen.getByTestId(id));
      expect(onAction.mock.calls.map((c) => c[0])).toEqual(["rematch", "newOpponent", "reviewField", "lobby"]);
    });
  });

  it("carries the viewer's best word, and no line when they scored none", () => {
    const { rerender } = render(<Slip slip={{ ...OVER, bestWord: { word: "borða", points: 29 } }} onAction={() => {}} />);
    expect(screen.getByTestId("slip-best-word")).toHaveTextContent("your best word · borða 29");
    rerender(<Slip slip={{ ...OVER, bestWord: null }} onAction={() => {}} />);
    expect(screen.queryByTestId("slip-best-word")).toBeNull();
  });

  it("writes the detail from its clauses, and only two of them when compact", () => {
    const verdict = { ...OVER.verdict, detailClauses: ["by 43 points", "10 words to 8", "territory 32–25"] };
    const { rerender } = render(<Slip slip={{ ...OVER, verdict }} onAction={() => {}} />);
    expect(screen.getByTestId("slip-detail")).toHaveTextContent("by 43 points · 10 words to 8 · territory 32–25");
    rerender(<Slip slip={{ ...OVER, verdict }} onAction={() => {}} compact />);
    expect(screen.getByTestId("slip-detail")).toHaveTextContent(/^by 43 points · 10 words to 8$/);
  });

  it("a draw is stated in ink; the label counts the match and says nothing of why it ended", () => {
    render(<Slip slip={{ ...OVER, verdict: { winnerSeat: null, scoreLine: "draw 140–140", detailLine: "" }, scores: { you: 140, opp: 140 } }} onAction={() => {}} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Draw");
    expect(screen.getByRole("heading")).not.toHaveAttribute("data-seat");
    // Why it ended is the verdict's detail line, never repeated in the label (§1.9).
    expect(screen.getByTestId("slip")).toHaveTextContent("match over · 4:52");
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
