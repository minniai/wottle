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

const STATUS_STYLE: Record<string, { background: string; borderColor: string }> = {
  running: { background: "rgba(15,23,42,0.85)",  borderColor: "rgba(148,163,184,0.2)" }, // default dark
  paused:  { background: "#d97706", borderColor: "rgba(252,211,77,0.4)" },                // amber
  expired: { background: "#dc2626", borderColor: "rgba(248,113,113,0.4)" },              // red
};

function truncateId(name: string, maxLen = 8): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + "…";
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

  const timerStatus: "expired" | "paused" | "running" =
    displaySeconds <= 0
      ? "expired"
      : hasSubmitted
        ? "paused"
        : "running";

  const statusStyle = STATUS_STYLE[timerStatus];
  const displayName = truncateId(playerName);

  return (
    <div
      className="game-chrome flex w-full items-center rounded-xl border px-3 py-2"
      style={{
        background: statusStyle.background,
        borderColor: statusStyle.borderColor,
        transition: "background 300ms ease, border-color 300ms ease",
      }}
      data-testid={`game-chrome-${position}`}
      data-position={position}
      data-timer-status={timerStatus}
    >
      {/* Left: player name + round */}
      <div className="flex min-w-0 flex-col">
        <span
          className="truncate text-xs font-medium text-white/80"
          title={playerName}
        >
          {displayName}
        </span>
        {moveCounter != null && (
          <span
            className="font-mono text-[10px] text-white/60"
            data-testid="round-indicator"
          >
            R{moveCounter}
          </span>
        )}
      </div>

      {/* Center: TIMER — the dominant element */}
      <div className="mx-auto flex items-baseline gap-2">
        <span
          className="font-mono text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-lg sm:text-5xl"
          data-testid="timer-panel"
        >
          {timerDisplay}
        </span>
        {timerStatus === "paused" && (
          <span className="text-xs font-bold uppercase tracking-wider text-white/70">
            Waiting
          </span>
        )}
        {timerStatus === "expired" && (
          <span className="text-xs font-bold uppercase tracking-wider text-white/70">
            Expired
          </span>
        )}
      </div>

      {/* Right: score + controls */}
      <div className="flex items-center gap-2">
        <div className="relative" data-testid="score-container">
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
