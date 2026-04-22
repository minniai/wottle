"use client";

import { PlayerAvatar } from "./PlayerAvatar";
import { TimerDisplay } from "./TimerDisplay";

interface PlayerPanelProps {
  player: {
    displayName: string;
    avatarUrl: string | null;
    eloRating: number;
  };
  gameState: {
    score: number;
    timerSeconds: number;
    isPaused: boolean;
    hasSubmitted: boolean;
    currentRound: number;
    totalRounds: number;
    playerColor: string;
  };
  isDisconnected?: boolean;
}

export function PlayerPanel({
  player,
  gameState,
  isDisconnected,
}: PlayerPanelProps) {
  return (
    <div
      data-testid="player-panel-compact"
      className="flex w-full items-center gap-2 rounded-lg border border-hair bg-paper px-3 py-1.5 shadow-wottle-sm"
    >
      <PlayerAvatar
        displayName={player.displayName}
        avatarUrl={player.avatarUrl}
        playerColor={gameState.playerColor}
        size="sm"
      />

      <span
        data-testid="player-name"
        className="min-w-0 truncate text-sm font-semibold text-ink"
      >
        {player.displayName}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <span data-testid="round-indicator" className="text-xs text-ink-soft">
          R{gameState.currentRound}
        </span>

        <TimerDisplay
          timerSeconds={gameState.timerSeconds}
          isPaused={gameState.isPaused}
          hasSubmitted={gameState.hasSubmitted}
          playerColor={gameState.playerColor}
          size="sm"
        />

        <span
          data-testid="player-score"
          className="font-black"
          style={{ color: gameState.playerColor, fontSize: "1.75rem" }}
        >
          {gameState.score}
        </span>

        {isDisconnected && (
          <span className="text-xs text-red-400">Disconnected</span>
        )}
      </div>
    </div>
  );
}
