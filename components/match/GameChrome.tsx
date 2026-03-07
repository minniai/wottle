"use client";

import { useEffect, useState } from "react";

import { ScoreDeltaPopup } from "@/components/match/ScoreDeltaPopup";
import type { ScoreDelta } from "@/components/match/ScoreDeltaPopup";

interface GameChromeProps {
  position: "opponent" | "player";
  playerName: string;
  score: number;
  timerSeconds: number;
  isPaused: boolean;
  hasSubmitted: boolean;
  moveCounter?: number;
  playerColor: string;
  /** Score breakdown for the just-completed round. Shown as a transient popup. */
  scoreDelta?: ScoreDelta | null;
  /** Round number used as a key to retrigger the popup animation. */
  scoreDeltaRound?: number;
  /** Number of completed rounds with history available. Button hidden when 0. */
  roundHistoryCount?: number;
  /** Callback to toggle the round history overlay. */
  onHistoryToggle?: () => void;
  /** Callback to trigger resignation. Only shown for the "player" position. */
  onResign?: () => void;
  /** Whether the resign button should be disabled (e.g. during resolution). */
  resignDisabled?: boolean;
}

const TIMER_BG: Record<string, string> = {
  running: "bg-emerald-600",
  paused: "bg-amber-500",
  expired: "bg-red-600",
};

const TIMER_BORDER: Record<string, string> = {
  running: "border-emerald-400/40",
  paused: "border-amber-300/40",
  expired: "border-red-400/40",
};

export function GameChrome({
  position,
  playerName,
  score,
  timerSeconds,
  isPaused,
  hasSubmitted,
  moveCounter,
  playerColor,
  scoreDelta,
  scoreDeltaRound,
  roundHistoryCount = 0,
  onHistoryToggle,
  onResign,
  resignDisabled = false,
}: GameChromeProps) {
  const [displaySeconds, setDisplaySeconds] = useState(timerSeconds);

  // Sync with authoritative server value whenever it arrives
  useEffect(() => {
    setDisplaySeconds(timerSeconds);
  }, [timerSeconds]);

  // Local 1-second countdown between server broadcasts
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setDisplaySeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const timerDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const timerStatus: "expired" | "paused" | "running" =
    displaySeconds <= 0
      ? "expired"
      : hasSubmitted
        ? "paused"
        : "running";

  const bgClass = TIMER_BG[timerStatus];
  const borderClass = TIMER_BORDER[timerStatus];

  const statusLabel =
    timerStatus === "paused"
      ? "Submitted"
      : timerStatus === "expired"
        ? "Time up"
        : null;

  return (
    <div
      className={`game-chrome flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-300 ${bgClass} ${borderClass}`}
      data-testid={`game-chrome-${position}`}
      data-position={position}
      data-timer-status={timerStatus}
    >
      {/* Player name */}
      <span className="min-w-0 truncate text-sm font-semibold text-white/90">
        {playerName}
      </span>

      {/* Score */}
      <div className="relative ml-auto" data-testid="score-container">
        <span
          className="text-2xl font-black tabular-nums"
          style={{ color: playerColor }}
        >
          {score}
        </span>
        {scoreDelta && (
          <ScoreDeltaPopup key={scoreDeltaRound} delta={scoreDelta} />
        )}
      </div>

      {/* Timer — the dominant element */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-lg bg-black/20 px-4 py-2 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl"
          data-testid="timer-panel"
        >
          {timerDisplay}
        </span>

        {statusLabel && (
          <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
            {statusLabel}
          </span>
        )}
      </div>

      {/* Auxiliary controls: round indicator, history, resign */}
      <div className="flex items-center gap-2">
        {moveCounter != null && (
          <span
            className="font-mono text-xs text-white/70"
            data-testid="round-indicator"
          >
            R{moveCounter}
          </span>
        )}

        {onHistoryToggle && roundHistoryCount > 0 && (
          <button
            type="button"
            aria-label="Round history"
            onClick={onHistoryToggle}
            className="relative rounded-md bg-black/20 px-2 py-1 text-xs text-white/80 transition hover:bg-black/30"
            data-testid="history-toggle"
          >
            <span aria-hidden="true">H</span>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-900">
              {roundHistoryCount}
            </span>
          </button>
        )}

        {onResign && (
          <button
            type="button"
            aria-label="Resign"
            onClick={onResign}
            disabled={resignDisabled}
            className="rounded-md bg-black/20 px-2 py-1 text-xs text-white/80 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="resign-button"
          >
            Resign
          </button>
        )}
      </div>
    </div>
  );
}
