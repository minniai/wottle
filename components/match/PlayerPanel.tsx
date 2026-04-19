"use client";

import { PlayerAvatar } from "./PlayerAvatar";
import { TimerDisplay } from "./TimerDisplay";
import type { ScoreDelta } from "./ScoreDeltaPopup";
import { ScoreDeltaPopup } from "./ScoreDeltaPopup";
import { RoundHistoryInline } from "./RoundHistoryInline";
import type { WordHistoryRow } from "./FinalSummary";

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
  controls?: {
    scoreDelta?: ScoreDelta | null;
    scoreDeltaRound?: number;
    roundHistoryCount?: number;
    onHistoryToggle?: () => void;
    onResign?: () => void;
    resignDisabled?: boolean;
  };
  roundHistory?: {
    playerId: string;
    accumulatedWords: WordHistoryRow[];
    completedRounds: number[];
  };
  variant: "full" | "compact";
  isDisconnected?: boolean;
}

function FullPanel({
  player,
  gameState,
  controls,
  isDisconnected,
  roundHistory,
}: Omit<PlayerPanelProps, "variant">) {
  return (
    <div
      data-testid="player-panel"
      className="flex flex-col items-center gap-3 rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <PlayerAvatar
        displayName={player.displayName}
        avatarUrl={player.avatarUrl}
        playerColor={gameState.playerColor}
        size="md"
      />

      <div className="flex flex-col items-center gap-0.5">
        <span
          data-testid="player-name"
          className="max-w-[12rem] truncate text-sm font-semibold text-ink"
        >
          {player.displayName}
        </span>
        <span
          data-testid="elo-rating"
          className="text-xs text-ink-soft"
        >
          {player.eloRating > 0 ? player.eloRating : "Unrated"}
        </span>
      </div>

      <TimerDisplay
        timerSeconds={gameState.timerSeconds}
        isPaused={gameState.isPaused}
        hasSubmitted={gameState.hasSubmitted}
        playerColor={gameState.playerColor}
        size="lg"
      />

      <div className="relative" data-testid="player-score">
        <span
          className="font-black"
          style={{ color: gameState.playerColor, fontSize: "3.5rem" }}
        >
          {gameState.score}
        </span>
        {controls?.scoreDelta && (
          <ScoreDeltaPopup
            key={controls.scoreDeltaRound}
            delta={controls.scoreDelta}
          />
        )}
      </div>

      <span data-testid="round-indicator" className="text-xs text-ink-soft">
        Round {gameState.currentRound} / {gameState.totalRounds}
      </span>

      {isDisconnected && (
        <span className="rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-300">
          Disconnected
        </span>
      )}

      {controls && (
        <div className="mt-1 flex items-center gap-2">
          {controls.onHistoryToggle &&
            (controls.roundHistoryCount ?? 0) > 0 && (
              <button
                aria-label="History"
                onClick={controls.onHistoryToggle}
                className="rounded border border-hair-strong px-2 py-1 text-xs text-ink-soft hover:bg-paper-2"
              >
                H {controls.roundHistoryCount}
              </button>
            )}
          {controls.onResign && (
            <button
              aria-label="Resign"
              onClick={controls.onResign}
              disabled={controls.resignDisabled}
              className="rounded border border-red-800/40 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-40"
            >
              Resign
            </button>
          )}
        </div>
      )}

      {roundHistory && (
        <RoundHistoryInline
          playerId={roundHistory.playerId}
          accumulatedWords={roundHistory.accumulatedWords}
          completedRounds={roundHistory.completedRounds}
        />
      )}
    </div>
  );
}

function CompactPanel({
  player,
  gameState,
  isDisconnected,
}: Omit<PlayerPanelProps, "variant" | "controls">) {
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
        <span
          data-testid="round-indicator"
          className="text-xs text-ink-soft"
        >
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

export function PlayerPanel(props: PlayerPanelProps) {
  if (props.variant === "compact") {
    return (
      <CompactPanel
        player={props.player}
        gameState={props.gameState}
        isDisconnected={props.isDisconnected}
      />
    );
  }

  return (
    <FullPanel
      player={props.player}
      gameState={props.gameState}
      controls={props.controls}
      isDisconnected={props.isDisconnected}
      roundHistory={props.roundHistory}
    />
  );
}
