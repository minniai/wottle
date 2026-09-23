import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

describe("Slip · resign and end early (spec 048 US7, spec 050)", () => {
  it("resign (C6): the safe action is primary and focused; yes, resign sits on a second line; Esc keeps playing", () => {
    const onAction = vi.fn();
    render(<Slip slip={{ kind: "resign", move: 4, clockMs: 192_000, opponentName: "Kári" }} onAction={onAction} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("move 4 of 10 · 3:12 left");
    expect(screen.getByRole("heading")).toHaveTextContent("Resign the match?");
    expect(slip).toHaveTextContent("Kári wins · your rating moves as a loss");
    // Destructive for the viewer, so the safe action leads (game flow §8 item 3).
    expect(screen.getByTestId("slip-keep-playing")).toHaveClass("action-primary");
    expect(screen.getByTestId("slip-confirm-resign")).toHaveClass("action-secondary");
    expect(document.activeElement).toBe(screen.getByTestId("slip-keep-playing"));
    expect(slip.querySelector(".slip__actions")).toHaveAttribute("data-stacked", "true");
    fireEvent.keyDown(slip, { key: "Escape" });
    fireEvent.click(screen.getByTestId("slip-confirm-resign"));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["keepPlaying", "confirmResign"]);
  });

  it("end early (C8): the headline is focused, the normal rules decide it, end the match ignores a click in its first 500ms", () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    render(<Slip slip={{ kind: "endEarly", opponentName: "Kári", opponentMoves: 8, clockMs: 72_000 }} onAction={onAction} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("10 of 10 played · 1:12 on the clock");
    expect(screen.getByRole("heading")).toHaveTextContent("Kári is gone");
    expect(slip).toHaveTextContent("the normal rules decide it");
    expect(slip).not.toHaveTextContent("0:00 left to reconnect");
    expect(document.activeElement).toBe(screen.getByRole("heading"));
    fireEvent.click(screen.getByTestId("slip-end-early"));
    expect(onAction).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByTestId("slip-keep-waiting"));
    fireEvent.click(screen.getByTestId("slip-end-early"));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["keepWaiting", "endEarly"]);
    vi.useRealTimers();
  });
});
