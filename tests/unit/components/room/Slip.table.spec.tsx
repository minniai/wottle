import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";
import type { SlipState } from "@/lib/room/slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

/** Spec 069 T016: the ready slip (game flow C1, canvas Table). */
const READY: SlipState = {
  kind: "ready",
  model: {
    label: "opponent found · 0:14",
    headline: { name: "Kári", rating: 1187 },
    facts: "english words · 10 moves each · one 5:00 clock",
    stakes: "win +8 · draw 0 · loss −8",
    seats: [
      { seat: "opp", name: "Kári", status: "on the way", seated: false },
      { seat: "you", name: "Birna · you", status: "ready", seated: true },
    ],
    actions: "ready+leave",
    drain: 0.7,
  },
};
const seatedModel = { ...(READY as Extract<SlipState, { kind: "ready" }>).model, actions: "seated+leave" as const };

describe("the ready slip (spec 069)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a dialog whose headline, the opponent, takes focus and is announced once", () => {
    render(<Slip slip={READY} onAction={() => {}} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveAttribute("role", "dialog");
    expect(slip).toHaveAttribute("data-kind", "ready");
    const headline = screen.getByRole("heading");
    expect(headline).toHaveTextContent("Kári");
    expect(headline).toHaveTextContent("1187");
    expect(headline).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(headline);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
  });

  it("reads the label, facts, stakes and both seat lines, in order", () => {
    render(<Slip slip={READY} onAction={() => {}} />);
    const text = screen.getByTestId("slip").textContent ?? "";
    const order = ["opponent found · 0:14", "Kári", "english words", "win +8 · draw 0 · loss −8", "on the way", "Birna · you", "ready ▸", "leave"];
    const at = order.map((s) => text.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const seats = screen.getAllByTestId("slip-seat");
    expect(seats.map((s) => s.getAttribute("data-seated"))).toEqual(["false", "true"]);
  });

  it("`ready ▸` is the primary, not focused, and ignores a press in its first 500ms", () => {
    const onAction = vi.fn();
    render(<Slip slip={READY} onAction={onAction} />);
    const ready = screen.getByTestId("slip-ready");
    expect(ready).toHaveClass("action-primary");
    expect(document.activeElement).not.toBe(ready);
    fireEvent.click(ready);
    expect(onAction).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(500));
    fireEvent.click(ready);
    expect(onAction).toHaveBeenCalledWith("sitDown");
    fireEvent.click(screen.getByTestId("slip-leave-table"));
    expect(onAction).toHaveBeenCalledWith("leaveTable");
  });

  it("once seated, row 1 is a wait with no button; `leave` keeps its own row", () => {
    render(<Slip slip={{ kind: "ready", model: seatedModel }} onAction={() => {}} />);
    expect(screen.queryByTestId("slip-ready")).toBeNull();
    const wait = screen.getByTestId("slip-seated");
    expect(wait).toHaveTextContent("you are seated");
    expect(within(wait).queryByRole("button")).toBeNull();
    expect(screen.getByTestId("slip-leave-table")).toHaveClass("action-secondary");
  });

  it("drains with the time left, and draws no drain once the start is set", () => {
    const { rerender } = render(<Slip slip={READY} onAction={() => {}} />);
    expect(screen.getByTestId("slip-drain")).toHaveStyle({ transform: "scaleX(0.7)" });
    rerender(<Slip slip={{ kind: "ready", model: { ...seatedModel, actions: "none", drain: null } }} onAction={() => {}} />);
    expect(screen.queryByTestId("slip-drain")).toBeNull();
    expect(screen.queryByTestId("slip-leave-table")).toBeNull();
  });

  it("omits the stakes line when there are none", () => {
    render(<Slip slip={{ kind: "ready", model: { ...seatedModel, stakes: null } }} onAction={() => {}} />);
    expect(screen.queryByTestId("slip-stakes")).toBeNull();
  });
});
