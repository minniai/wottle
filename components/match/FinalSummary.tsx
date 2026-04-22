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
import { PostGameVerdict } from "@/components/match/PostGameVerdict";
import {
  PostGameScoreboard,
  type ScoreboardEntry,
} from "@/components/match/PostGameScoreboard";
import { RoundByRoundChart } from "@/components/match/RoundByRoundChart";
import { WordsOfMatch } from "@/components/match/WordsOfMatch";

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

  const totalDurationMs = useMemo(
    () => players.reduce((acc, p) => Math.max(acc, p.timeUsedMs), 0),
    [players],
  );

  const outcome: "win" | "loss" | "draw" = useMemo(() => {
    if (!winnerId) return "draw";
    return winnerId === currentPlayerId ? "win" : "loss";
  }, [winnerId, currentPlayerId]);

  const pointMargin = useMemo(() => {
    const scores = players.map((p) => p.score);
    if (scores.length < 2) return 0;
    return Math.abs(scores[0] - scores[1]);
  }, [players]);

  const wordCountByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of wordHistory) {
      counts.set(w.playerId, (counts.get(w.playerId) ?? 0) + 1);
    }
    return counts;
  }, [wordHistory]);

  const bestWordByPlayer = useMemo(() => {
    const best = new Map<string, WordHistoryRow>();
    for (const w of wordHistory) {
      const prev = best.get(w.playerId);
      if (!prev || w.totalPoints > prev.totalPoints) {
        best.set(w.playerId, w);
      }
    }
    return best;
  }, [wordHistory]);

  const scoreboardEntries = useMemo<
    [ScoreboardEntry, ScoreboardEntry] | null
  >(() => {
    if (!playerA || !playerB) return null;
    const toEntry = (
      player: PlayerSummary,
      slot: "player_a" | "player_b",
    ): ScoreboardEntry => ({
      id: player.id,
      displayName: player.displayName,
      slot,
      score: player.score,
      wordsCount: wordCountByPlayer.get(player.id) ?? 0,
      frozenTileCount: player.frozenTileCount,
      bestWord: bestWordByPlayer.get(player.id)?.word ?? null,
      ratingDelta: player.ratingDelta,
      isCurrentPlayer: player.id === currentPlayerId,
      isWinner: player.id === winnerId,
    });
    return [toEntry(playerA, "player_a"), toEntry(playerB, "player_b")];
  }, [playerA, playerB, wordCountByPlayer, bestWordByPlayer, currentPlayerId, winnerId]);

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
        viewerId={currentPlayerId}
        onClose={() => setProfilePlayerId(null)}
        // Post-game drill-in: Challenge is a no-op. Rematch lives in a separate
        // flow; clicking Challenge from post-game would surprise users.
        onChallenge={() => setProfilePlayerId(null)}
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
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section className="min-w-0 space-y-6">
            <PostGameVerdict
              outcome={outcome}
              totalRounds={scoreboard.length}
              durationMs={totalDurationMs}
              pointMargin={pointMargin}
              opponentName={opponent?.displayName ?? "Opponent"}
              reasonLabel={
                isDualTimeout ? "Both players timed out" : reasonLabel(endedReason)
              }
            />

            {endedReason === "forfeit" && winner && (
              <p
                className="text-sm text-ink-soft"
                data-testid="final-summary-forfeit-label"
              >
                {winner.id === currentPlayerId
                  ? "Your opponent resigned"
                  : "You resigned"}
              </p>
            )}

            {rematchPhase === "interstitial" && <RematchInterstitial />}

            {seriesBadgeText() && (
              <p
                className="rounded-xl border border-hair-strong bg-paper-2 px-4 py-2 text-sm font-medium text-ink-3"
                data-testid="series-badge"
              >
                {seriesBadgeText()}
              </p>
            )}

            {rematchPhase === "incoming" && requesterName && (
              <RematchBanner
                requesterName={requesterName}
                onAccept={acceptRematch}
                onDecline={declineRematch}
              />
            )}

            {rematchError && (
              <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-sm text-bad">
                {rematchError}
              </p>
            )}

            {scoreboardEntries && (
              <div data-testid="final-summary-scoreboard">
                <PostGameScoreboard entries={scoreboardEntries} />
              </div>
            )}

            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                Round by round
              </p>
              <RoundByRoundChart rounds={scoreboard} />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-2xl bg-ink px-5 py-3 text-paper transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          </section>

          <aside className="min-w-0 space-y-6">
            <WordsOfMatch
              wordHistory={wordHistory}
              playerASlotId={playerA?.id ?? ""}
            />
          </aside>
        </div>
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
