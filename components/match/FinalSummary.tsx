"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { FrozenTileMap, MatchEndedReason, SeriesContext, TopWord } from "@/lib/types/match";
import type { BoardGrid, Coordinate } from "@/lib/types/board";
import { BoardGrid as BoardGridComponent } from "@/components/game/BoardGrid";
import { RoundHistoryPanel } from "@/components/match/RoundHistoryPanel";
import { deriveRoundHistory } from "@/components/match/deriveRoundHistory";
import { deriveBiggestSwing, deriveHighestScoringWord } from "@/components/match/deriveCallouts";
import {
  PLAYER_A_HIGHLIGHT,
  PLAYER_B_HIGHLIGHT,
  PLAYER_A_HEX,
  PLAYER_B_HEX,
} from "@/lib/constants/playerColors";
import { PlayerAvatar } from "@/components/match/PlayerAvatar";
import { useRematchNegotiation } from "@/components/match/useRematchNegotiation";
import { RematchBanner } from "@/components/match/RematchBanner";
import { RematchInterstitial } from "@/components/match/RematchInterstitial";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";

interface PlayerSummary {
  id: string;
  username: string;
  displayName: string;
  score: number;
  timeRemainingMs: number;
  timeUsedMs: number;
  frozenTileCount: number;
  topWords: TopWord[];
  ratingBefore?: number;
  ratingAfter?: number;
  ratingDelta?: number;
}

export interface ScoreboardRow {
  roundNumber: number;
  playerAScore: number;
  playerBScore: number;
  playerADelta: number;
  playerBDelta: number;
}

export interface WordHistoryRow {
  roundNumber: number;
  playerId: string;
  word: string;
  totalPoints: number;
  lettersPoints: number;
  bonusPoints: number;
  /** Tile positions where the word appeared on the board */
  coordinates: Coordinate[];
}

export interface FinalSummaryProps {
  matchId: string;
  currentPlayerId: string;
  winnerId: string | null;
  endedReason: MatchEndedReason;
  players: PlayerSummary[];
  scoreboard: ScoreboardRow[];
  wordHistory: WordHistoryRow[];
  board: BoardGrid | null;
  /** Frozen tile map for player-colored overlays on the final board. */
  frozenTiles?: FrozenTileMap;
  /** True when both players' timers expired (dual timeout). */
  isDualTimeout?: boolean;
  /** Series context for rematch chains (game number, score). */
  seriesContext?: SeriesContext;
}

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function reasonLabel(reason: MatchEndedReason) {
  switch (reason) {
    case "round_limit":
      return "10 rounds completed";
    case "timeout":
      return "Time expired";
    case "disconnect":
      return "Disconnected opponent";
    case "forfeit":
      return "Forfeit";
    default:
      return "Completed";
  }
}

function TopWordsList({ words }: { words: TopWord[] }) {
  if (words.length === 0) {
    return <p className="text-xs text-ink-soft">No words scored</p>;
  }

  return (
    <ul className="mt-2 space-y-1">
      {words.map((entry, idx) => (
        <li
          key={`${entry.word}-${idx}`}
          className="flex items-center justify-between text-xs text-ink-3"
        >
          <span className="font-mono uppercase tracking-wide">{entry.word}</span>
          <span>{entry.totalPoints} pts</span>
        </li>
      ))}
    </ul>
  );
}

function RatingDeltaDisplay({
  ratingDelta,
  ratingAfter,
}: {
  ratingDelta?: number;
  ratingAfter?: number;
}) {
  if (ratingDelta === undefined) {
    return (
      <p
        className="mt-1 text-sm text-ink-soft italic"
        data-testid="rating-pending"
      >
        Rating update pending
      </p>
    );
  }

  const sign = ratingDelta > 0 ? "+" : "";
  const color =
    ratingDelta > 0
      ? "text-emerald-400"
      : ratingDelta < 0
        ? "text-rose-400"
        : "text-ink-soft";

  return (
    <p className="mt-1 text-sm" data-testid="rating-delta">
      <span className={`font-semibold ${color}`}>
        {sign}
        {ratingDelta}
      </span>
      {ratingAfter !== undefined && (
        <span className="ml-2 text-ink-soft">
          → {ratingAfter}
        </span>
      )}
    </p>
  );
}

type ActiveTab = "overview" | "round-history";

export function FinalSummary({
  matchId,
  currentPlayerId,
  winnerId,
  endedReason,
  players,
  scoreboard,
  wordHistory,
  board,
  frozenTiles,
  isDualTimeout = false,
  seriesContext,
}: FinalSummaryProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [highlightPlayerColors, setHighlightPlayerColors] = useState<Record<string, string>>({});
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);

  const winner = useMemo(() => players.find((player) => player.id === winnerId), [
    players,
    winnerId,
  ]);

  const currentPlayer = players.find((player) => player.id === currentPlayerId);
  const opponent = players.find((player) => player.id !== currentPlayerId);

  const playerA = players[0];
  const playerB = players[1];

  // Determine slot-based colors: players[0] = player_a (blue), players[1] = player_b (red)
  const currentIsPlayerA = currentPlayerId === playerA?.id;
  const currentPlayerColor = currentIsPlayerA ? PLAYER_A_HEX : PLAYER_B_HEX;
  const opponentColor = currentIsPlayerA ? PLAYER_B_HEX : PLAYER_A_HEX;

  const {
    phase: rematchPhase,
    requestRematch: handleRematch,
    acceptRematch,
    declineRematch,
    error: rematchError,
    requesterName,
  } = useRematchNegotiation(
    matchId,
    currentPlayerId,
    opponent?.displayName ?? "Opponent",
  );

  const usernameMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.displayName])),
    [players],
  );

  const roundHistory = useMemo(
    () =>
      deriveRoundHistory(
        wordHistory,
        scoreboard,
        playerA?.id ?? "",
        playerA?.displayName ?? "Player A",
        playerB?.id ?? "",
        playerB?.displayName ?? "Player B",
      ),
    [wordHistory, scoreboard, playerA, playerB],
  );

  const biggestSwing = useMemo(() => deriveBiggestSwing(scoreboard), [scoreboard]);
  const highestWord = useMemo(() => deriveHighestScoringWord(wordHistory, usernameMap), [wordHistory, usernameMap]);

  const handleWordHover = (word: WordHistoryRow | null) => {
    if (!word) {
      setHighlightPlayerColors({});
      return;
    }
    const color = word.playerId === playerA?.id ? PLAYER_A_HIGHLIGHT : PLAYER_B_HIGHLIGHT;
    const colors: Record<string, string> = {};
    for (const coord of word.coordinates) {
      colors[`${coord.x},${coord.y}`] = color;
    }
    setHighlightPlayerColors(colors);
  };

  const isRematchDisabled =
    rematchPhase !== "idle" && rematchPhase !== "incoming";

  function rematchButtonLabel(): string {
    switch (rematchPhase) {
      case "requesting":
        return "Requesting...";
      case "waiting":
        return "Waiting for opponent...";
      case "declined":
        return "Opponent declined";
      case "expired":
        return "No response — returning to lobby";
      case "accepted":
      case "interstitial":
        return "Starting new game...";
      default:
        return "Rematch";
    }
  }

  function seriesBadgeText(): string | null {
    if (!seriesContext || seriesContext.gameNumber <= 1) return null;
    const { currentPlayerWins, opponentWins, draws } = seriesContext;
    let scoreText: string;
    if (currentPlayerWins > opponentWins) {
      scoreText = `You lead ${currentPlayerWins}-${opponentWins}`;
    } else if (opponentWins > currentPlayerWins) {
      scoreText = `${opponent?.displayName ?? "Opponent"} leads ${opponentWins}-${currentPlayerWins}`;
    } else {
      scoreText = `Tied ${currentPlayerWins}-${opponentWins}`;
    }
    if (draws > 0) {
      scoreText += ` (${draws} draw${draws > 1 ? "s" : ""})`;
    }
    return `Game ${seriesContext.gameNumber} — ${scoreText}`;
  }

  return (
    <>
    {profilePlayerId && (
      <PlayerProfileModal
        playerId={profilePlayerId}
        onClose={() => setProfilePlayerId(null)}
      />
    )}
    <section
      className="w-full overflow-hidden rounded-3xl border border-hair bg-paper p-3 shadow-wottle-lg sm:p-8"
      data-testid="final-summary-root"
    >
      {/* Board with player HUD panels, matching in-game 3-column layout */}
      {board && (
        <div className="summary-board-layout mb-6" data-testid="final-summary-board">
          {/* Left panel: current player (same as in-game) */}
          <div className="summary-board-layout__panel">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-hair bg-paper-2 p-4">
              <PlayerAvatar
                displayName={currentPlayer?.displayName ?? "You"}
                avatarUrl={null}
                playerColor={currentPlayerColor}
                size="md"
              />
              <span className="max-w-[10rem] truncate text-sm font-semibold text-ink">
                {currentPlayer?.displayName ?? "You"}
              </span>
              <span
                className="font-black"
                style={{ color: currentPlayerColor, fontSize: "3rem" }}
              >
                {currentPlayer?.score ?? 0}
              </span>
              <span className="text-xs text-ink-soft">
                Time used: {formatDuration(currentPlayer?.timeUsedMs ?? 0)}
              </span>
            </div>
          </div>

          {/* Board */}
          <div className="summary-board-layout__board">
            <BoardGridComponent
              grid={board}
              matchId={matchId}
              className="pointer-events-none"
              frozenTiles={frozenTiles}
              highlightPlayerColors={highlightPlayerColors}
              persistentHighlight
            />
          </div>

          {/* Right panel: opponent (same as in-game) */}
          <div className="summary-board-layout__panel">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-hair bg-paper-2 p-4">
              <PlayerAvatar
                displayName={opponent?.displayName ?? "Opponent"}
                avatarUrl={null}
                playerColor={opponentColor}
                size="md"
              />
              <span className="max-w-[10rem] truncate text-sm font-semibold text-ink">
                {opponent?.displayName ?? "Opponent"}
              </span>
              <span
                className="font-black"
                style={{ color: opponentColor, fontSize: "3rem" }}
              >
                {opponent?.score ?? 0}
              </span>
              <span className="text-xs text-ink-soft">
                Time used: {formatDuration(opponent?.timeUsedMs ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Tab bar */}
      <div className="mb-6 flex gap-2 border-b border-hair pb-1" role="tablist" aria-label="Match summary">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          aria-controls="tab-panel-overview"
          id="tab-overview"
          onClick={() => setActiveTab("overview")}
          className={`rounded-t-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === "overview"
              ? "border-b-2 border-emerald-400 text-emerald-300"
              : "text-ink-soft hover:text-ink"
          }`}
          data-testid="tab-overview"
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "round-history"}
          aria-controls="tab-panel-round-history"
          id="tab-round-history"
          onClick={() => setActiveTab("round-history")}
          className={`rounded-t-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === "round-history"
              ? "border-b-2 border-emerald-400 text-emerald-300"
              : "text-ink-soft hover:text-ink"
          }`}
          data-testid="tab-round-history"
        >
          Round History
        </button>
      </div>

      {/* Overview tab panel */}
      <div
        id="tab-panel-overview"
        role="tabpanel"
        aria-labelledby="tab-overview"
        hidden={activeTab !== "overview"}
      >
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">
          Match Complete
        </p>
        <h1 className="text-3xl font-bold text-ink">Final Summary</h1>
        <p
          className="text-ink-3"
          data-testid="final-summary-ended-reason"
        >
          {isDualTimeout ? "Both players timed out" : reasonLabel(endedReason)}
        </p>
      </header>

      {winner ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm uppercase tracking-wide text-emerald-200/80">
            Winner
          </p>
          <p className="text-2xl font-semibold text-ink">
            {winner.displayName}
          </p>
          {endedReason === "forfeit" && (
            <p
              className="mt-1 text-sm text-ink-soft"
              data-testid="final-summary-forfeit-label"
            >
              {winner.id === currentPlayerId
                ? "Your opponent resigned"
                : "You resigned"}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
          <p className="text-sm uppercase tracking-wide text-sky-200/80">
            Draw
          </p>
          <p className="text-2xl font-semibold text-ink">
            Both players tied after the final round.
          </p>
        </div>
      )}

      {rematchPhase === "interstitial" && <RematchInterstitial />}

      {seriesBadgeText() && (
        <p
          className="mt-4 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200"
          data-testid="series-badge"
        >
          {seriesBadgeText()}
        </p>
      )}

      {rematchPhase === "incoming" && requesterName && (
        <div className="mt-4">
          <RematchBanner
            requesterName={requesterName}
            onAccept={acceptRematch}
            onDecline={declineRematch}
          />
        </div>
      )}

      {rematchError && (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {rematchError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-2xl bg-emerald-500 px-5 py-3 text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
          onClick={handleRematch}
          disabled={isRematchDisabled}
          data-testid="final-summary-rematch"
        >
          {rematchButtonLabel()}
        </button>
        <button
          type="button"
          className="rounded-2xl border border-hair-strong px-5 py-3 text-ink transition hover:bg-paper-2"
          onClick={() => router.push("/")}
          data-testid="final-summary-back-lobby"
        >
          Back to Lobby
        </button>
      </div>

      <div
        className="mt-6 grid gap-4 md:grid-cols-2"
        data-testid="final-summary-scoreboard"
      >
        {players.map((player) => (
          <div
            key={player.id}
            className={`rounded-2xl border p-4 ${
              player.id === winnerId
                ? "border-emerald-400/40 bg-emerald-500/5"
                : "border-hair bg-paper-2"
            }`}
          >
            <button
              type="button"
              className="text-xs uppercase tracking-wide text-ink-soft hover:text-emerald-300 transition"
              onClick={() => setProfilePlayerId(player.id)}
            >
              {player.id === currentPlayerId ? "You" : player.displayName}
            </button>
            <p className="mt-2 text-4xl font-bold text-ink">{player.score}</p>
            <p className="mt-1 text-sm text-ink-3">
              Time used: {formatDuration(player.timeUsedMs)}
            </p>
            <p className="mt-1 text-sm text-ink-3">
              {player.frozenTileCount} tiles frozen
            </p>
            <RatingDeltaDisplay
              ratingDelta={player.ratingDelta}
              ratingAfter={player.ratingAfter}
            />
            {player.topWords.length > 0 && (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-ink-soft">
                  Top words
                </p>
                <TopWordsList words={player.topWords} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="mt-8 rounded-2xl border border-hair bg-paper-2 p-4"
        data-testid="final-summary-timers"
      >
        <h2 className="text-lg font-semibold text-ink">Per-round Scoreboard</h2>
        <div className="mt-4 space-y-2">
          {scoreboard.length === 0 && (
            <p className="text-sm text-ink-soft">
              No scoreboard snapshots recorded for this match.
            </p>
          )}
          {scoreboard.map((row) => (
            <div
              key={row.roundNumber}
              className="flex items-center justify-between rounded-xl bg-paper-3 px-4 py-2 text-sm text-ink-3"
            >
              <span>Round {row.roundNumber}</span>
              <span>
                {row.playerAScore}–{row.playerBScore}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="mt-8 rounded-2xl border border-hair bg-paper-2 p-4"
        data-testid="final-summary-word-history"
      >
        <h2 className="text-lg font-semibold text-ink">Word History</h2>
        {wordHistory.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            No words were scored in this match.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {wordHistory.map((entry, index) => {
              const player = players.find((p) => p.id === entry.playerId);
              return (
                <div
                  key={`${entry.roundNumber}-${entry.word}-${index}`}
                  className="rounded-xl border border-hair bg-paper-3 px-4 py-3 text-sm text-ink"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Round {entry.roundNumber}</span>
                    <span className="text-ink-soft">
                      {entry.totalPoints} pts
                    </span>
                  </div>
                  <p className="text-lg font-mono uppercase tracking-wide">
                    {entry.word}
                  </p>
                  <p className="text-ink-3">
                    {player?.displayName ?? "Unknown"} ·{" "}
                    {entry.lettersPoints} base + {entry.bonusPoints} bonus
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {currentPlayer && (
        <p className="mt-4 text-sm text-ink-soft">
          Playing as <span className="font-semibold">{currentPlayer.displayName}</span>
        </p>
      )}
      </div>{/* end overview tab panel */}

      {/* Round History tab panel */}
      <div
        id="tab-panel-round-history"
        role="tabpanel"
        aria-labelledby="tab-round-history"
        hidden={activeTab !== "round-history"}
        data-testid="tab-panel-round-history"
      >
        <RoundHistoryPanel
          rounds={roundHistory}
          playerAUsername={playerA?.displayName ?? "Player A"}
          playerBUsername={playerB?.displayName ?? "Player B"}
          scores={scoreboard}
          wordHistory={wordHistory}
          biggestSwing={biggestSwing}
          highestWord={highestWord}
          onWordHover={handleWordHover}
        />
      </div>
    </section>
    </>
  );
}
