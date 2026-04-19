"use client";

import { useState } from "react";

import type { RoundHistoryEntry } from "@/components/match/deriveRoundHistory";
import type { WordHistoryRow, ScoreboardRow } from "@/components/match/FinalSummary";
import type { BiggestSwingCallout, HighestScoringWordCallout } from "@/components/match/deriveCallouts";

interface RoundHistoryPanelProps {
  rounds: RoundHistoryEntry[];
  playerAUsername: string;
  playerBUsername: string;
  scores?: ScoreboardRow[];
  wordHistory?: WordHistoryRow[];
  biggestSwing?: BiggestSwingCallout | null;
  highestWord?: HighestScoringWordCallout | null;
  onWordHover?: (word: WordHistoryRow | null) => void;
}

function WordRow({
  word,
  onWordHover,
}: {
  word: WordHistoryRow;
  onWordHover?: (word: WordHistoryRow | null) => void;
}) {
  return (
    <li
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-paper-2"
      onMouseEnter={() => onWordHover?.(word)}
      onMouseLeave={() => onWordHover?.(null)}
      onFocus={() => onWordHover?.(word)}
      onBlur={() => onWordHover?.(null)}
      tabIndex={onWordHover ? 0 : undefined}
    >
      <span className="font-mono uppercase tracking-wide text-ink">
        {word.word}
      </span>
      <span className="ml-4 shrink-0 text-ink-soft">
        <span className="text-ink-soft">{word.word.length}L</span>
        {" · "}
        <span>{word.lettersPoints}</span>
        {word.bonusPoints > 0 && (
          <span className="text-emerald-400"> +{word.bonusPoints}</span>
        )}
        {" = "}
        <span className="font-semibold text-ink">{word.totalPoints} pts</span>
      </span>
    </li>
  );
}

function PlayerWordSection({
  username,
  words,
  roundNumber,
  onWordHover,
}: {
  username: string;
  words: WordHistoryRow[];
  roundNumber: number;
  onWordHover?: (word: WordHistoryRow | null) => void;
}) {
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {username}
      </p>
      <ul
        role="list"
        aria-label={`Words scored by ${username} in round ${roundNumber}`}
        className="mt-1 space-y-1"
      >
        {words.length === 0 ? (
          <li className="text-sm text-ink-soft/50">No words</li>
        ) : (
          words.map((w, i) => (
            <WordRow key={`${w.word}-${i}`} word={w} onWordHover={onWordHover} />
          ))
        )}
      </ul>
    </div>
  );
}

function RoundRow({
  entry,
  playerAUsername,
  playerBUsername,
  onWordHover,
}: {
  entry: RoundHistoryEntry;
  playerAUsername: string;
  playerBUsername: string;
  onWordHover?: (word: WordHistoryRow | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const panelId = `round-history-panel-${entry.roundNumber}`;
  const triggerId = `round-history-trigger-${entry.roundNumber}`;

  const fmtDelta = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="rounded-xl border border-hair bg-paper-2">
      <button
        type="button"
        id={triggerId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-paper-3"
        data-testid={`round-row-${entry.roundNumber}`}
      >
        <span className="font-semibold text-ink">Round {entry.roundNumber}</span>
        <span className="flex items-center gap-4 text-sm">
          <span className="text-blue-400">
            {playerAUsername}: {fmtDelta(entry.playerA.delta)}{" "}
            <span className="text-ink-soft">({entry.playerA.cumulative})</span>
          </span>
          <span className="text-red-400">
            {playerBUsername}: {fmtDelta(entry.playerB.delta)}{" "}
            <span className="text-ink-soft">({entry.playerB.cumulative})</span>
          </span>
          <span
            className={`ml-2 text-ink-soft transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="border-t border-hair px-4 pb-4"
        >
          <PlayerWordSection
            username={playerAUsername}
            words={entry.playerA.words}
            roundNumber={entry.roundNumber}
            onWordHover={onWordHover}
          />
          <PlayerWordSection
            username={playerBUsername}
            words={entry.playerB.words}
            roundNumber={entry.roundNumber}
            onWordHover={onWordHover}
          />
        </div>
      )}
    </div>
  );
}

export function RoundHistoryPanel({
  rounds,
  playerAUsername,
  playerBUsername,
  biggestSwing,
  highestWord,
  onWordHover,
}: RoundHistoryPanelProps) {
  return (
    <div className="space-y-3" data-testid="round-history-panel">
      {(biggestSwing !== undefined || highestWord !== undefined) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {biggestSwing ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3" data-testid="callout-biggest-swing">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Biggest swing
              </p>
              <p className="mt-1 text-sm text-ink">
                Round {biggestSwing.roundNumber}{" "}
                <span className="text-ink-soft">(±{biggestSwing.swingAmount} pts)</span>
              </p>
            </div>
          ) : (
            biggestSwing === null && (
              <div className="rounded-xl border border-hair bg-paper-2 px-4 py-3 text-sm text-ink-soft" data-testid="callout-no-swing">
                No scoring swings
              </div>
            )
          )}
          {highestWord ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3" data-testid="callout-highest-word">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Top word
              </p>
              <p className="mt-1 font-mono text-sm font-semibold uppercase text-ink">
                {highestWord.word}
              </p>
              <p className="text-xs text-ink-soft">
                {highestWord.username} · Round {highestWord.roundNumber} · {highestWord.totalPoints} pts
              </p>
            </div>
          ) : (
            highestWord === null && (
              <div className="rounded-xl border border-hair bg-paper-2 px-4 py-3 text-sm text-ink-soft" data-testid="callout-no-word">
                No scored words
              </div>
            )
          )}
        </div>
      )}

      {rounds.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft" data-testid="round-history-empty">
          No rounds completed.
        </p>
      ) : (
        rounds.map((entry) => (
          <RoundRow
            key={entry.roundNumber}
            entry={entry}
            playerAUsername={playerAUsername}
            playerBUsername={playerBUsername}
            onWordHover={onWordHover}
          />
        ))
      )}
    </div>
  );
}
