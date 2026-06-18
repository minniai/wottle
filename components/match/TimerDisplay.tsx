"use client";

import type { CSSProperties } from "react";

import { deriveClockUrgency } from "./deriveClockUrgency";

interface TimerDisplayProps {
  timerSeconds: number;
  isPaused: boolean;
  hasSubmitted: boolean;
  playerColor: string;
  size: "lg" | "sm";
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TimerDisplay({
  timerSeconds,
  isPaused,
  hasSubmitted,
  size,
}: TimerDisplayProps) {
  const { tone, urgency } = deriveClockUrgency(
    isPaused ? "paused" : "running",
    timerSeconds,
  );

  const sizeClasses = size === "lg" ? "px-5 py-4" : "px-3 py-1.5";

  const classes = [
    "timer-display flex items-center justify-center rounded-lg font-mono font-black text-ink",
    sizeClasses,
    `timer-display--${tone}`,
    tone === "critical" ? "timer-display--blink" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style = {
    fontSize: size === "lg" ? "3rem" : "1.5rem",
    minWidth: size === "lg" ? "12rem" : "6rem",
    "--clock-urgency": urgency,
    ...(hasSubmitted
      ? {
          boxShadow:
            "0 0 0 2px rgba(245, 158, 11, 0.6), 0 0 12px rgba(245, 158, 11, 0.3)",
        }
      : {}),
  } as CSSProperties;

  return (
    <div className="flex flex-col items-center gap-1">
      <div data-testid="timer-display" className={classes} style={style}>
        <span>{formatTime(timerSeconds)}</span>
      </div>
    </div>
  );
}
