"use client";

import type { CSSProperties } from "react";

import { formatClock, isLowClock, laneFraction, MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";

export type LaneMode = "clock" | "searching" | "disconnected" | "empty";

interface ClockLaneProps {
  /** Accessible name of the progressbar (`your clock` / `opponent's clock`). */
  label: string;
  clockMs: number;
  running: boolean;
  budgetMs?: number;
  mode?: LaneMode;
}

/**
 * The bar's edge nearest the field (design system §5.3): full width = the match
 * budget, the filled part is the time left. Under 1:00 it thickens and blinks
 * (colour only); disconnected it is dashed and held; searching it carries a
 * travelling segment.
 */
export function ClockLane({ label, clockMs, running, budgetMs = MATCH_CLOCK_BUDGET_MS, mode = "clock" }: ClockLaneProps) {
  const fraction = mode === "empty" ? 0 : laneFraction(clockMs, budgetMs);
  const low = mode === "clock" && isLowClock(clockMs);
  const seconds = Math.max(0, Math.floor(clockMs / 1000));
  const className = [
    "player-bar__lane",
    low ? "player-bar__lane--low" : "",
    mode === "disconnected" ? "player-bar__lane--disconnected" : "",
    mode === "searching" ? "player-bar__lane--searching" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const valueText =
    mode === "searching" ? "searching" : `${formatClock(clockMs)} remaining, ${running ? "running" : "stopped"}`;

  return (
    <div
      className={className}
      data-testid="player-bar-lane"
      data-low={low || undefined}
      data-mode={mode}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(budgetMs / 1000)}
      aria-valuenow={mode === "searching" ? undefined : seconds}
      aria-valuetext={valueText}
      style={{ "--lane-fraction": fraction } as CSSProperties}
    >
      <div className="player-bar__lane-fill" />
    </div>
  );
}
