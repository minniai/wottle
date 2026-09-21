import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

describe("Slip · resign and end early (spec 048 US7, spec 050)", () => {
  it("resign: move and clock, the question, the consequence, yes/keep playing", () => {
    const onAction = vi.fn();
    render(<Slip slip={{ kind: "resign", move: 4, clockMs: 192_000, opponentName: "Kári" }} onAction={onAction} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("move 4 of 10 · 3:12 left");
    expect(screen.getByRole("heading")).toHaveTextContent("Resign the match?");
    expect(slip).toHaveTextContent("Kári wins · your rating moves as a loss");
    expect(document.activeElement).toBe(screen.getByTestId("slip-confirm-resign"));
    fireEvent.click(screen.getByTestId("slip-keep-playing"));
    fireEvent.click(screen.getByTestId("slip-confirm-resign"));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["keepPlaying", "confirmResign"]);
  });

  it("end early: the opponent is gone with moves short, the window is spent, end/keep waiting", () => {
    const onAction = vi.fn();
    render(<Slip slip={{ kind: "endEarly", opponentName: "Kári", opponentMoves: 8, clockMs: 72_000 }} onAction={onAction} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("10 of 10 played · 1:12 on the clock");
    expect(slip).toHaveTextContent("Kári 8 of 10 · 0:00 left to reconnect");
    expect(screen.getByRole("heading")).toHaveTextContent("Kári is gone");
    expect(slip).toHaveTextContent("0:00 left to reconnect");
    expect(document.activeElement).toBe(screen.getByTestId("slip-end-early"));
    fireEvent.click(screen.getByTestId("slip-keep-waiting"));
    fireEvent.click(screen.getByTestId("slip-end-early"));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["keepWaiting", "endEarly"]);
  });
});
