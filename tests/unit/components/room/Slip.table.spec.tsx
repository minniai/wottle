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

/** Spec 069 T040: the void slip (game flow C3, canvas Void). */
describe("the void slip (spec 069)", () => {
  const VOID: SlipState = {
    kind: "void",
    model: { label: "no match", headline: "Kári did not sit down", body: ["nothing was rated", "you are back in the queue"], actions: ["cancelQueue"], requeued: true },
  };

  it("focuses its headline and says nothing was rated", () => {
    render(<Slip slip={VOID} onAction={() => {}} />);
    expect(screen.getByTestId("slip")).toHaveAttribute("data-kind", "void");
    const headline = screen.getByRole("heading");
    expect(headline).toHaveTextContent("Kári did not sit down");
    expect(document.activeElement).toBe(headline);
    expect(screen.getByTestId("slip")).toHaveTextContent("nothing was rated");
    expect(screen.getByTestId("slip")).toHaveTextContent("you are back in the queue");
  });

  it("a requeued viewer's search runs under the body; its only action is `cancel ▸`, a secondary", () => {
    const onAction = vi.fn();
    render(<Slip slip={{ kind: "void", model: { ...(VOID as Extract<SlipState, { kind: "void" }>).model, searching: "searching · 0:03" } }} onAction={onAction} />);
    expect(screen.getByTestId("slip-void-searching")).toHaveTextContent("searching · 0:03");
    const cancel = screen.getByTestId("slip-void-cancelQueue");
    expect(cancel).toHaveClass("action-secondary");
    expect(screen.queryByRole("button", { name: /lobby/ })).toBeNull();
    fireEvent.click(cancel);
    expect(onAction).toHaveBeenCalledWith("cancelQueue");
  });

  it("after a challenge offers `challenge again ▸` and `lobby`; after a rematch the result", () => {
    const onAction = vi.fn();
    const { rerender } = render(<Slip slip={{ kind: "void", model: { ...(VOID as Extract<SlipState, { kind: "void" }>).model, body: ["nothing was rated"], actions: ["challengeAgain", "lobby"], requeued: false } }} onAction={onAction} />);
    fireEvent.click(screen.getByTestId("slip-void-challengeAgain"));
    expect(onAction).toHaveBeenCalledWith("challengeAgain");
    expect(screen.getByTestId("slip-void-challengeAgain")).toHaveTextContent("challenge again ▸");
    rerender(<Slip slip={{ kind: "void", model: { ...(VOID as Extract<SlipState, { kind: "void" }>).model, actions: ["result", "lobby"], requeued: false } }} onAction={onAction} />);
    fireEvent.click(screen.getByTestId("slip-void-result"));
    expect(onAction).toHaveBeenCalledWith("result");
    fireEvent.click(screen.getByTestId("slip-void-lobby"));
    expect(onAction).toHaveBeenCalledWith("lobby");
  });
});

describe("the resign slip's stake (spec 069 US8)", () => {
  it("draws the loss in ink, never as a points-lost number", () => {
    render(<Slip slip={{ kind: "resign", move: 4, clockMs: 192_000, opponentName: "Kári", loss: -9 }} onAction={() => {}} />);
    expect(screen.getByTestId("slip")).toHaveTextContent("your rating moves as a loss · −9");
    expect(document.querySelector(".points-lost")).toBeNull();
  });
});
