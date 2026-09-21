"use client";

import type { CSSProperties, ReactNode } from "react";

import { points } from "@/lib/constants/copy";
import { getSeatColors, type Seat } from "@/lib/constants/seatColors";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import { BarLane, type LaneMode } from "./BarLane";

/** `idle` = a signed-in seat outside a match (lobby): name + sub-line, no total. */
export type PlayerBarState = "empty" | "searching" | "found" | "playing" | "final" | "idle";

export interface PlayerBarProps {
  seat: Seat;
  position: "top" | "bottom";
  state: PlayerBarState;
  name?: string;
  subline: string;
  /** Spec 050: this player's move count, in the seat colour while a move is the viewer's to make. */
  sublineSuffix?: string | null;
  sublineTone?: "seat" | "muted";
  /** The opponent has just been found: their name is written in (FR-028). */
  writing?: boolean;
  /** Resolved moves: the lane empties one segment per move (2026-09-21). */
  movesPlayed?: number;
  /** A move of this player's is in flight: its segment shows as scoring. */
  moveInFlight?: boolean;
  moveLimit?: number;
  score?: number;
  disconnected?: boolean;
  /** Primary action when the seat is empty or searching. */
  action?: ReactNode;
}

function laneMode(state: PlayerBarState, disconnected: boolean): LaneMode {
  if (state === "empty" || state === "idle") return "empty";
  if (state === "searching") return "searching";
  return disconnected ? "disconnected" : "moves";
}

/**
 * One player's facts (design system §5.3, spec 050): seat square + name +
 * one-line sub-line | total or primary action. There is no clock in a bar; the
 * match clock is the ledger's. The opponent is always the top bar, the
 * viewer the bottom; the lane sits on the edge nearest the field.
 */
export function PlayerBar(props: PlayerBarProps) {
  const { seat, position, state, name, subline, writing = false, movesPlayed = 0, moveLimit = TOTAL_MOVES, moveInFlight = false } = props;
  const { score, disconnected = false, action } = props;
  const inMatch = state === "playing" || state === "final";
  const showsScore = inMatch && typeof score === "number";
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
          <span className={`player-bar__name${writing ? " player-bar__name--writing" : ""}`} data-testid="player-bar-name">
            {name ?? ""}
          </span>
          <span className="player-bar__subline" data-testid="player-bar-subline">
            {subline}
            {props.sublineSuffix ? (
              <span className="player-bar__subline-suffix" data-tone={props.sublineTone ?? "muted"} data-testid="player-bar-turn">
                {" · "}
                {props.sublineSuffix}
              </span>
            ) : null}
          </span>
        </div>
      </div>
      {showsScore ? (
        <div className="player-bar__score" data-testid="player-bar-score">
          {points(score)}
        </div>
      ) : (
        <div className="player-bar__action" data-testid="player-bar-action">
          {action}
        </div>
      )}
      <BarLane label={seat === "you" ? "your moves" : "opponent's moves"} movesPlayed={movesPlayed} moveLimit={moveLimit} moveInFlight={moveInFlight} mode={laneMode(state, disconnected)} />
    </div>
  );
}
