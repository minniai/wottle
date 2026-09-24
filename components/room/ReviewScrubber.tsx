"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";

import { stepAtFraction } from "@/lib/review/scrubber";

export interface ReviewScrubberProps {
  step: number;
  stepCount: number;
  fraction: number;
  valueText: string;
  /** Its accessible name: `review step`. */
  label: string;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
}

/**
 * Spec 071 (FR-033, FR-034): the review's scrubber in the scoreboard's clock row. One slider:
 * it takes focus and owns ←/→, Home/End and Space while it has it; a tap or drag picks the step
 * under the pointer. The field's arrows and the buttons' Space are untouched.
 */
export function ReviewScrubber({ step, stepCount, fraction, valueText, label, onStep, onTogglePlay }: ReviewScrubberProps) {
  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), stepCount);
    if (clamped !== step) onStep(clamped);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = keyTarget(e.key, step, stepCount);
    if (e.key === " ") onTogglePlay();
    else if (target === null) return;
    else go(target);
    e.preventDefault();
  };
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (e.type === "pointermove" && e.buttons !== 1) return;
    const box = e.currentTarget.getBoundingClientRect();
    go(stepAtFraction(box.width > 0 ? (e.clientX - box.left) / box.width : 0, stepCount));
  };
  return (
    <div
      className="review-scrubber"
      data-testid="review-scrubber"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={stepCount}
      aria-valuenow={step}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onPointerDown={onPointer}
      onPointerMove={onPointer}
    >
      <span className="review-scrubber__bar" aria-hidden="true">
        <span className="review-scrubber__fill" style={{ "--fraction": String(fraction) } as CSSProperties} />
      </span>
    </div>
  );
}

function keyTarget(key: string, step: number, stepCount: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return step + 1;
    case "ArrowLeft":
    case "ArrowDown":
      return step - 1;
    case "Home":
      return 1;
    case "End":
      return stepCount;
    default:
      return null;
  }
}
