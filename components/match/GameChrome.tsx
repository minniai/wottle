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

  return (
    <div
      className="flex w-full items-center justify-between rounded-lg bg-slate-800/80 px-4 py-2"
      data-testid={`game-chrome-${position}`}
      data-position={position}
    >
      <span className="text-sm font-medium text-white/90">
        {playerName}
      </span>

      <div className="relative" data-testid="score-container">
        <span
          className="text-xl font-bold"
          style={{ color: playerColor }}
        >
          {score}
        </span>
        {scoreDelta && (
          <ScoreDeltaPopup key={scoreDeltaRound} delta={scoreDelta} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-lg ${
            !hasSubmitted ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          {timerDisplay}
        </span>

        {isPaused && (
          <span className="text-xs text-yellow-400">Paused</span>
        )}

        {moveCounter != null && (
          <span
            className="font-mono text-sm text-white/60"
            data-testid="round-indicator"
          >
            Round {moveCounter}
          </span>
        )}

        {onHistoryToggle && roundHistoryCount > 0 && (
          <button
            type="button"
            aria-label="Round history"
            onClick={onHistoryToggle}
            className="relative rounded-md bg-white/10 px-2 py-1 text-xs text-white/80 transition hover:bg-white/20"
            data-testid="history-toggle"
          >
            <span aria-hidden="true">H</span>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
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
            className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="resign-button"
          >
            Resign
          </button>
        )}
      </div>
    </div>
  );
}
