import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LineSlot } from "@/components/page/LineSlot";
import type { SlotModel } from "@/lib/pages/slotLines";

const base: SlotModel = { style: "status", square: "you", line1: "Link copied · valid 9:58", line2: "", primary: null, secondaries: [{ label: "copy again ▸", action: "copyLink" }, { label: "cancel link ▸", action: "cancelLink" }], bar: { kind: "drain", fraction: 0.99 } };

/** Spec 072 T028: the link's slot is a wait: no primary, its way out, its drain. */
describe("LineSlot · links", () => {
  it("draws copy again and cancel as secondaries and the 10:00 drain", () => {
    const onAction = vi.fn();
    render(<LineSlot model={base} onAction={onAction} announcement="" variant="desktop" />);
    expect(screen.queryByTestId("slot-copyLink")).not.toBeNull();
    fireEvent.click(screen.getByTestId("slot-cancelLink"));
    expect(onAction).toHaveBeenCalledWith("cancelLink");
    expect(document.querySelector(".line-slot__primary")).toBeNull();
    expect(document.querySelector(".line-slot__drain")).not.toBeNull();
  });

  it("shows a refused link as text to select, not as a label", () => {
    render(<LineSlot model={{ ...base, line1: "Link ready · valid 9:58", line2: "https://wottle.test/c/abc", line2IsUrl: true }} onAction={vi.fn()} announcement="" variant="desktop" />);
    const url = screen.getByTestId("line-slot-url") as HTMLInputElement;
    expect(url.value).toBe("https://wottle.test/c/abc");
    expect(url.readOnly).toBe(true);
    expect(screen.queryByTestId("line-slot-line2")).toBeNull();
  });
});
