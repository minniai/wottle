import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewScrubber } from "@/components/room/ReviewScrubber";

function scrub(over: Partial<Parameters<typeof ReviewScrubber>[0]> = {}) {
  const onStep = vi.fn();
  const onTogglePlay = vi.fn();
  render(<ReviewScrubber step={7} stepCount={20} fraction={0.35} valueText="step 7 of 20, Birna, LEK ÆSKU plus 33" label="review step" onStep={onStep} onTogglePlay={onTogglePlay} {...over} />);
  return { slider: screen.getByRole("slider"), onStep, onTogglePlay };
}

describe("ReviewScrubber (spec 071 FR-033, FR-034)", () => {
  it("is one slider that takes focus and says where review stands", () => {
    const { slider } = scrub();
    expect(slider).toHaveAttribute("tabindex", "0");
    expect(slider).toHaveAttribute("aria-valuemin", "1");
    expect(slider).toHaveAttribute("aria-valuemax", "20");
    expect(slider).toHaveAttribute("aria-valuenow", "7");
    expect(slider).toHaveAttribute("aria-valuetext", "step 7 of 20, Birna, LEK ÆSKU plus 33");
    expect(slider).toHaveAccessibleName("review step");
  });

  it("owns the step keys while it has focus", () => {
    const { slider, onStep, onTogglePlay } = scrub();
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End", "ArrowUp", "ArrowDown"]) fireEvent.keyDown(slider, { key });
    fireEvent.keyDown(slider, { key: " " });
    expect(onStep.mock.calls.map((c) => c[0])).toEqual([8, 6, 1, 20, 8, 6]);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("stays within the steps at either end", () => {
    const { slider, onStep } = scrub({ step: 20 });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("takes a tap on the bar as the step under it", () => {
    const { slider, onStep } = scrub();
    slider.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, height: 10, right: 300, bottom: 10, x: 100, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(slider, { clientX: 200 });
    expect(onStep).toHaveBeenCalledWith(11);
  });
});
