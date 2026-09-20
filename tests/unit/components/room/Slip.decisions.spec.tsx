import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

describe("Slip · resign and claim the win (spec 048 US7)", () => {
  it("resign: round and clock, the question, the consequence, yes/keep playing", () => {
    const onAction = vi.fn();
    render(<Slip slip={{ kind: "resign", round: 4, clockMs: 252_000, opponentName: "Kári" }} onAction={onAction} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("round 4 of 10 · 4:12 on your clock");
    expect(screen.getByRole("heading")).toHaveTextContent("Resign the match?");
    expect(slip).toHaveTextContent("Kári wins · your rating moves as a loss");
    expect(document.activeElement).toBe(screen.getByTestId("slip-confirm-resign"));
    fireEvent.click(screen.getByTestId("slip-keep-playing"));
    fireEvent.click(screen.getByTestId("slip-confirm-resign"));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["keepPlaying", "confirmResign"]);
  });

  it("claim the win: the opponent is gone, the window is spent, claim/keep waiting", () => {
    const onAction = vi.fn();
    render(<Slip slip={{ kind: "claimWin", opponentName: "Kári", round: 4 }} onAction={onAction} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("round 4 of 10");
    expect(screen.getByRole("heading")).toHaveTextContent("Kári is gone");
    expect(slip).toHaveTextContent("0:00 left to reconnect");
    expect(document.activeElement).toBe(screen.getByTestId("slip-claim-win"));
    fireEvent.click(screen.getByTestId("slip-keep-waiting"));
    fireEvent.click(screen.getByTestId("slip-claim-win"));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["keepWaiting", "claimWin"]);
  });
});
