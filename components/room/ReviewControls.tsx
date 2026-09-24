"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";

export type ReviewControl = "first" | "back" | "play" | "next" | "last";

export interface ReviewControlsProps {
  step: number;
  stepCount: number;
  playing: boolean;
  /** A phone: glyphs with spoken labels, 44×44, pinned in the foot (game flow F7). */
  compact?: boolean;
  onControl: (control: ReviewControl) => void;
}

const GLYPHS: Record<ReviewControl, string> = { first: "◂◂", back: "◂", play: "▶", next: "▸", last: "▸▸" };
const PAUSE_GLYPH = "‖";

/**
 * Spec 071 (FR-035): first · back · play ▸ · next · last. `play ▸` reads `pause` while review
 * plays itself, one step a second. A button that cannot move is disabled, never hidden.
 */
export function ReviewControls({ step, stepCount, playing, compact = false, onControl }: ReviewControlsProps) {
  const { review } = useCopy();
  const words: Record<ReviewControl, string> = { first: review.FIRST, back: review.BACK, play: playing ? review.PAUSE : review.PLAY, next: review.NEXT, last: review.LAST };
  const disabled: Record<ReviewControl, boolean> = { first: step <= 1, back: step <= 1, play: false, next: step >= stepCount, last: step >= stepCount };
  const order: ReviewControl[] = ["first", "back", "play", "next", "last"];
  return (
    <span className={`review-controls${compact ? " review-controls--compact" : ""}`} data-testid="review-controls">
      {order.map((control) => (
        <button
          key={control}
          type="button"
          className={compact ? "review-controls__glyph" : "action-secondary"}
          data-testid={`review-${control}`}
          disabled={disabled[control]}
          aria-label={compact ? words[control].replace(/ ▸$/, "") : undefined}
          onClick={() => onControl(control)}
        >
          {compact ? (control === "play" && playing ? PAUSE_GLYPH : GLYPHS[control]) : words[control]}
        </button>
      ))}
    </span>
  );
}
