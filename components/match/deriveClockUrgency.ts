/**
 * Visual urgency state for a match clock (O-59).
 *
 * Both the desktop HUD clock and the mobile compact bar derive their colour and
 * blink treatment from this single function so the two surfaces never drift.
 *
 * Thresholds come from the issue: the clock turns yellow at 30s and ramps to red
 * toward zero; at 15s it blinks. A paused clock (the player has already submitted)
 * shows no urgency.
 */

export type ClockTone =
  | "active"
  | "warning"
  | "critical"
  | "expired"
  | "waiting";

export interface ClockUrgency {
  tone: ClockTone;
  /** 0 at 30s, ramping to 1 at 0s. Only meaningful for warning/critical. */
  urgency: number;
}

const WARNING_SECONDS = 30;
const BLINK_SECONDS = 15;

function urgencyRatio(seconds: number): number {
  const ratio = (WARNING_SECONDS - seconds) / WARNING_SECONDS;
  return Math.min(1, Math.max(0, ratio));
}

export function deriveClockUrgency(
  status: "running" | "paused" | "expired",
  seconds: number,
): ClockUrgency {
  if (status === "paused") return { tone: "waiting", urgency: 0 };
  if (status === "expired" || seconds <= 0) {
    return { tone: "expired", urgency: 1 };
  }
  if (seconds > WARNING_SECONDS) return { tone: "active", urgency: 0 };

  const urgency = urgencyRatio(seconds);
  const tone = seconds <= BLINK_SECONDS ? "critical" : "warning";
  return { tone, urgency };
}
