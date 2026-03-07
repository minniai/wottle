"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { requestRematchAction } from "@/app/actions/match/requestRematch";
import type { MatchEndedReason, TopWord } from "@/lib/types/match";
import type { BoardGrid, Coordinate } from "@/lib/types/board";
import { BoardGrid as BoardGridComponent } from "@/components/game/BoardGrid";
import { RoundHistoryPanel } from "@/components/match/RoundHistoryPanel";
import { deriveRoundHistory } from "@/components/match/deriveRoundHistory";
import { deriveBiggestSwing, deriveHighestScoringWord } from "@/components/match/deriveCallouts";
import {
  PLAYER_A_HIGHLIGHT,
  PLAYER_B_HIGHLIGHT,
} from "@/lib/constants/playerColors";

interface PlayerSummary {
  id: string;
  username: string;
  displayName: string;
  score: number;
  timeRemainingMs: number;
  timeUsedMs: number;
  frozenTileCount: number;
  topWords: TopWord[];
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
    return <p className="text-xs text-white/40">No words scored</p>;
  }

  return (
    <ul className="mt-2 space-y-1">
      {words.map((entry) => (
        <li
          key={entry.word}
          className="flex items-center justify-between text-xs text-white/70"
        >
          <span className="font-mono uppercase tracking-wide">{entry.word}</span>
          <span>{entry.totalPoints} pts</span>
        </li>
      ))}
    </ul>
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
}: FinalSummaryProps) {
  const router = useRouter();
  const [isRematching, startRematch] = useTransition();
  const [rematchError, setRematchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [highlightPlayerColors, setHighlightPlayerColors] = useState<Record<string, string>>({});

  const winner = useMemo(() => players.find((player) => player.id === winnerId), [
    players,
    winnerId,
  ]);

  const currentPlayer = players.find((player) => player.id === currentPlayerId);

  const playerA = players[0];
  const playerB = players[1];

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

  const handleRematch = () => {
    setRematchError(null);
    startRematch(async () => {
      try {
        const result = await requestRematchAction(matchId);
        router.push(`/match/${result.matchId}`);
      } catch (error) {
        setRematchError(
          error instanceof Error ? error.message : "Unable to start rematch.",
        );
      }
    });
  };

  return (
    <section
      className="w-full rounded-3xl border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/60"
      data-testid="final-summary-view"
    >
      {/* Board rendered outside tab area so it stays visible on both tabs */}
      {board && (
        <div className="mb-6" data-testid="final-summary-board">
          <BoardGridComponent
            grid={board}
            matchId={matchId}
            className="mx-auto"
            highlightPlayerColors={highlightPlayerColors}
            persistentHighlight
          />
        </div>
      )}
      {/* Tab bar */}
      <div className="mb-6 flex gap-2 border-b border-white/10 pb-1" role="tablist" aria-label="Match summary">
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
              : "text-white/60 hover:text-white/90"
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
              : "text-white/60 hover:text-white/90"
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
        <h1 className="text-3xl font-bold text-white">Final Summary</h1>
        <p
          className="text-white/70"
          data-testid="final-summary-ended-reason"
        >
          {reasonLabel(endedReason)}
        </p>
      </header>

      {winner ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm uppercase tracking-wide text-emerald-200/80">
            Winner
          </p>
          <p className="text-2xl font-semibold text-white">
            {winner.displayName}
          </p>
          {endedReason === "forfeit" && (
            <p
              className="mt-1 text-sm text-white/60"
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
          <p className="text-2xl font-semibold text-white">
            Both players tied after the final round.
          </p>
        </div>
      )}

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
                : "border-white/10 bg-white/5"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-white/60">
              {player.id === currentPlayerId ? "You" : player.displayName}
            </p>
            <p className="mt-2 text-4xl font-bold text-white">{player.score}</p>
            <p className="mt-1 text-sm text-white/70">
              Time used: {formatDuration(player.timeUsedMs)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {player.frozenTileCount} tiles frozen
            </p>
            {player.topWords.length > 0 && (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-white/40">
                  Top words
                </p>
                <TopWordsList words={player.topWords} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4"
        data-testid="final-summary-timers"
      >
        <h2 className="text-lg font-semibold text-white">Per-round Scoreboard</h2>
        <div className="mt-4 space-y-2">
          {scoreboard.length === 0 && (
            <p className="text-sm text-white/60">
              No scoreboard snapshots recorded for this match.
            </p>
          )}
          {scoreboard.map((row) => (
            <div
              key={row.roundNumber}
              className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-2 text-sm text-white/80"
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
        className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4"
        data-testid="final-summary-word-history"
      >
        <h2 className="text-lg font-semibold text-white">Word History</h2>
        {wordHistory.length === 0 ? (
          <p className="mt-2 text-sm text-white/60">
            No words were scored in this match.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {wordHistory.map((entry, index) => {
              const player = players.find((p) => p.id === entry.playerId);
              return (
                <div
                  key={`${entry.roundNumber}-${entry.word}-${index}`}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Round {entry.roundNumber}</span>
                    <span className="text-white/60">
                      {entry.totalPoints} pts
                    </span>
                  </div>
                  <p className="text-lg font-mono uppercase tracking-wide">
                    {entry.word}
                  </p>
                  <p className="text-white/70">
                    {player?.displayName ?? "Unknown"} ·{" "}
                    {entry.lettersPoints} base + {entry.bonusPoints} bonus
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rematchError && (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {rematchError}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-2xl bg-emerald-500 px-5 py-3 text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
          onClick={handleRematch}
          disabled={isRematching}
          data-testid="final-summary-rematch"
        >
          {isRematching ? "Creating match…" : "Rematch"}
        </button>
        <button
          type="button"
          className="rounded-2xl border border-white/20 px-5 py-3 text-white transition hover:bg-white/10"
          onClick={() => router.push("/")}
          data-testid="final-summary-back-lobby"
        >
          Back to Lobby
        </button>
      </div>

      {currentPlayer && (
        <p className="mt-4 text-sm text-white/60">
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
  );
}
