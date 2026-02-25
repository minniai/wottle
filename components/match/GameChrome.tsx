"use client";

import { useEffect, useState } from "react";

interface GameChromeProps {
  position: "opponent" | "player";
  playerName: string;
  score: number;
  timerSeconds: number;
  isPaused: boolean;
  hasSubmitted: boolean;
  moveCounter?: number;
  playerColor: string;
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

      {position === "opponent" && moveCounter != null && (
        <span
          className="text-sm font-bold text-white/70"
          data-testid="round-indicator"
        >
          Round {moveCounter}
        </span>
      )}

      <span
        className="text-xl font-bold"
        style={{ color: playerColor }}
      >
        {score}
      </span>

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

        {position === "player" && moveCounter != null && (
          <span className="font-mono text-sm text-white/60">
            M{moveCounter}
          </span>
        )}
      </div>
    </div>
  );
}
