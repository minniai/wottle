"use client";

import type { CSSProperties, ReactNode } from "react";

import { getSeatColors, type Seat } from "@/lib/constants/seatColors";
import { formatClock, MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";
import { ClockLane, type LaneMode } from "./ClockLane";

export type PlayerBarState = "empty" | "searching" | "found" | "playing" | "final";

export interface PlayerBarProps {
  seat: Seat;
  position: "top" | "bottom";
  state: PlayerBarState;
  name?: string;
  subline: string;
  clockMs?: number;
  clockRunning?: boolean;
  budgetMs?: number;
  score?: number;
  disconnected?: boolean;
  /** Primary action when the seat is empty or searching. */
  action?: ReactNode;
  /** Landing: the inline name input replaces the name. */
  nameInput?: ReactNode;
}

function laneMode(state: PlayerBarState, disconnected: boolean): LaneMode {
  if (state === "empty") return "empty";
  if (state === "searching") return "searching";
  return disconnected ? "disconnected" : "clock";
}

/**
 * One player's facts (design system §5.3): seat square + name + one-line
 * sub-line | clock | total or primary action. The opponent is always the top
 * bar, the viewer the bottom; the lane sits on the edge nearest the field.
 */
export function PlayerBar(props: PlayerBarProps) {
  const { seat, position, state, name, subline, clockMs = MATCH_CLOCK_BUDGET_MS, clockRunning = false } = props;
  const { budgetMs = MATCH_CLOCK_BUDGET_MS, score, disconnected = false, action, nameInput } = props;
  const showsClock = state === "playing" || state === "final";
  const showsScore = showsClock && typeof score === "number";
  const style = { "--seat-ink": getSeatColors(seat).ink } as CSSProperties;

  return (
    <div
      className={`player-bar player-bar--${position} player-bar--${state}`}
      data-testid={`player-bar-${position}`}
      data-seat={seat}
      data-state={state}
      style={style}
    >
      <div className="player-bar__identity">
        <span className="player-bar__seat" aria-hidden />
        <div className="player-bar__text">
          {nameInput ?? (
            <span className="player-bar__name" data-testid="player-bar-name">
              {name ?? ""}
            </span>
          )}
          <span className="player-bar__subline" data-testid="player-bar-subline">
            {subline}
          </span>
        </div>
      </div>
      <div
        className={`player-bar__clock${showsClock && !clockRunning ? " player-bar__clock--stopped" : ""}`}
        data-testid="player-bar-clock"
        data-running={showsClock ? clockRunning : undefined}
      >
        {showsClock ? formatClock(clockMs) : ""}
      </div>
      {showsScore ? (
        <div className="player-bar__score" data-testid="player-bar-score">
          {score}
        </div>
      ) : (
        <div className="player-bar__action" data-testid="player-bar-action">
          {action}
        </div>
      )}
      <ClockLane clockMs={clockMs} running={clockRunning} budgetMs={budgetMs} mode={laneMode(state, disconnected)} />
    </div>
  );
}
