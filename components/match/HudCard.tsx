import type { ReactNode } from "react";

type ClockState = "idle" | "active" | "low" | "waiting";

interface HudCardProps {
  slot: "you" | "opp";
  avatar: ReactNode;
  name: string;
  meta: string;
  clock: string;
  clockState?: ClockState;
  score: number;
  children?: ReactNode;
}

export function HudCard({
  slot,
  avatar,
  name,
  meta,
  clock,
  clockState = "idle",
  score,
  children,
}: HudCardProps) {
  const slotClass = slot === "you" ? "hud-card--you" : "hud-card--opp";
  const clockStateClass =
    clockState === "active"
      ? "hud-card__clock--active"
      : clockState === "low"
        ? "hud-card__clock--low"
        : clockState === "waiting"
          ? "hud-card__clock--waiting"
          : "";

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
        className={`hud-card__clock ${clockStateClass}`.trim()}
      >
        {clock}
      </span>
      <span className="hud-card__score">{score}</span>
      {children}
    </div>
  );
}
