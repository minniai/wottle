import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { LineSlot } from "@/components/page/LineSlot";
import type { SlotModel } from "@/lib/pages/slotLines";

const CALL: SlotModel = {
  style: "call",
  square: "opp",
  line1: "Kári challenges you",
  line2: "1179 · your record 3–1 · 0:47 to answer",
  primary: { label: "accept ▸", action: "accept" },
  secondaries: [{ label: "decline", action: "decline" }],
  bar: { kind: "drain", fraction: 0.78 },
};
const SENT: SlotModel = { style: "status", square: "you", line1: "Challenge sent · Embla · 0:52", line2: "english words", primary: null, secondaries: [{ label: "withdraw ▸", action: "withdraw" }], bar: { kind: "drain", fraction: 0.8 } };
const TERMS: SlotModel = { style: "terms", square: null, line1: "", line2: "", primary: null, secondaries: [], bar: null };

function renderSlot(model: SlotModel, onAction = vi.fn(), announcement = "") {
  return render(
    <LocaleProvider locale="en">
      <LineSlot model={model} onAction={onAction} announcement={announcement} variant="desktop" />
    </LocaleProvider>,
  );
}

/** Spec 070 US4 (T081): the line slot. */
describe("LineSlot", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a region labelled for challenges, in call style with the drain", () => {
    renderSlot(CALL);
    const region = screen.getByRole("region", { name: "challenges" });
    expect(region.getAttribute("data-style")).toBe("call");
    expect(screen.getByText("Kári challenges you")).toBeTruthy();
    expect(region.querySelector(".line-slot__drain")?.getAttribute("style")).toContain("scaleX(0.78)");
  });

  it("ignores accept for 500ms after it appears, then accepts", async () => {
    const onAction = vi.fn();
    renderSlot(CALL, onAction);
    fireEvent.click(screen.getByRole("button", { name: "accept ▸" }));
    expect(onAction).not.toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(600)));
    fireEvent.click(screen.getByRole("button", { name: "accept ▸" }));
    expect(onAction).toHaveBeenCalledWith("accept");
    fireEvent.click(screen.getByRole("button", { name: "decline" }));
    expect(onAction).toHaveBeenCalledWith("decline");
  });

  it("draws a wait with no primary: its exit is a secondary", () => {
    renderSlot(SENT);
    expect(screen.queryByRole("button", { name: /accept/ })).toBeNull();
    expect(document.querySelector(".action-primary")).toBeNull();
    expect(screen.getByRole("button", { name: "withdraw ▸" }).className).toContain("page-link");
  });

  it("says its line politely and never takes focus", () => {
    renderSlot(CALL, vi.fn(), "Kári challenges you, 47 seconds to answer");
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Kári challenges you, 47 seconds to answer");
    expect(document.activeElement).toBe(document.body);
  });

  it("shows the place and the terms when nothing stands", () => {
    renderSlot(TERMS);
    expect(screen.getByTestId("slot-empty").textContent).toContain("every match rated");
  });
});
