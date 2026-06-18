import type { CSSProperties, ReactNode } from "react";

import type { ClockTone } from "./deriveClockUrgency";

interface HudCardProps {
  slot: "you" | "opp";
  avatar: ReactNode;
  name: string;
  meta: string;
  clock: string;
  clockState?: ClockTone | "idle";
  /** 0..1 urgency ratio driving the yellow→red gradient (O-59). */
  clockUrgency?: number;
  score: number;
  children?: ReactNode;
}

const TONE_CLASS: Record<ClockTone | "idle", string> = {
  idle: "",
  active: "hud-card__clock--active",
  warning: "hud-card__clock--warning",
  critical: "hud-card__clock--critical",
  expired: "hud-card__clock--expired",
  waiting: "hud-card__clock--waiting",
};

export function HudCard({
  slot,
  avatar,
  name,
  meta,
  clock,
  clockState = "idle",
  clockUrgency = 0,
  score,
  children,
}: HudCardProps) {
  const slotClass = slot === "you" ? "hud-card--you" : "hud-card--opp";
  const clockClasses = [
    "hud-card__clock",
    TONE_CLASS[clockState],
    clockState === "critical" ? "hud-card__clock--blink" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Cast: --clock-urgency is a custom property, not in CSSProperties' typed keys.
  const clockStyle = {
    "--clock-urgency": clockUrgency,
  } as CSSProperties;

  return (
    <div data-testid="hud-card" className={`hud-card ${slotClass}`}>
      <div className="hud-card__avatar">{avatar}</div>
      <div className="hud-card__identity">
        <span className="hud-card__name" title={name}>
          {name}
        </span>
        <span className="hud-card__meta">{meta}</span>
      </div>
      <span
        data-testid="hud-card-clock"
        className={clockClasses}
        style={clockStyle}
      >
        {clock}
      </span>
      <span className="hud-card__score">{score}</span>
      {children}
    </div>
  );
}
