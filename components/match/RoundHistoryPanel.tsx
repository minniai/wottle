"use client";

import { useMemo, useState } from "react";

import type { RoundHistoryEntry } from "@/components/match/deriveRoundHistory";
import type { WordHistoryRow, ScoreboardRow } from "@/components/match/FinalSummary";
import type { BiggestSwingCallout, HighestScoringWordCallout } from "@/components/match/deriveCallouts";

interface RoundHistoryPanelProps {
  rounds: RoundHistoryEntry[];
  playerAUsername: string;
  playerBUsername: string;
  /** Player A's playerId — lets us tint the "Top word" callout in the
   *  scoring player's color (issue #209 follow-up). When omitted, the
   *  callout falls back to the player A tint. */
  playerASlotId?: string;
  scores?: ScoreboardRow[];
  wordHistory?: WordHistoryRow[];
  biggestSwing?: BiggestSwingCallout | null;
  highestWord?: HighestScoringWordCallout | null;
  /**
   * Fired with the words to highlight on the board, or `null` to clear.
   * A single-element array is sent for a word-row hover; the union of both
   * players' words for that round is sent for a round-row hover.
   */
  onHighlight?: (words: WordHistoryRow[] | null) => void;
}

/** Tailwind class set per player slot, used by the BIGGEST SWING / TOP WORD
 *  callouts so they live inside the Warm Editorial palette instead of the
 *  green/red --good / --warn semantics that clashed with the brand. */
const SLOT_CALLOUT_CLASSES = {
  player_a: {
    container: "border-p1-deep/30 bg-p1/10",
    label: "text-p1-deep",
  },
  player_b: {
    container: "border-p2-deep/30 bg-p2/10",
    label: "text-p2-deep",
  },
} as const;

function WordRow({
  word,
  onHighlight,
}: {
  word: WordHistoryRow;
  onHighlight?: (words: WordHistoryRow[] | null) => void;
}) {
  // Stop propagation so the parent round-row's mouseenter handler doesn't
  // overwrite the word-level highlight when the cursor crosses into a word.
  const handleEnter = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    onHighlight?.([word]);
  };
  const handleLeave = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    onHighlight?.(null);
  };

  return (
    <li
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-paper-2"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      tabIndex={onHighlight ? 0 : undefined}
    >
      <span className="font-mono uppercase tracking-wide text-ink">
        {word.word}
      </span>
      <span className="ml-4 shrink-0 text-ink-soft">
        <span className="text-ink-soft">{word.word.length}L</span>
        {" · "}
        <span>{word.lettersPoints}</span>
        {word.bonusPoints > 0 && (
          <span className="text-good"> +{word.bonusPoints}</span>
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
  onHighlight,
}: {
  username: string;
  words: WordHistoryRow[];
  roundNumber: number;
  onHighlight?: (words: WordHistoryRow[] | null) => void;
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
            <WordRow key={`${w.word}-${i}`} word={w} onHighlight={onHighlight} />
          ))
        )}
      </ul>
    </div>
  );
}

function RoundRow({
  entry,
  expanded,
  onToggle,
  playerAUsername,
  playerBUsername,
  onHighlight,
}: {
  entry: RoundHistoryEntry;
  expanded: boolean;
  onToggle: () => void;
  playerAUsername: string;
  playerBUsername: string;
  onHighlight?: (words: WordHistoryRow[] | null) => void;
}) {
  const panelId = `round-history-panel-${entry.roundNumber}`;
  const triggerId = `round-history-trigger-${entry.roundNumber}`;

  const fmtDelta = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const handleEnter = () => {
    if (!onHighlight) return;
    onHighlight([...entry.playerA.words, ...entry.playerB.words]);
  };
  const handleLeave = () => onHighlight?.(null);

  return (
    <div
      className="rounded-xl border border-hair bg-paper-2"
      data-testid={`round-row-${entry.roundNumber}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        id={triggerId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-paper-3"
      >
        <span className="font-semibold text-ink">Round {entry.roundNumber}</span>
        <span className="flex items-center gap-4 text-sm">
          <span className="text-p1">
            {playerAUsername}: {fmtDelta(entry.playerA.delta)}{" "}
            <span className="text-ink-soft">({entry.playerA.cumulative})</span>
          </span>
          <span className="text-p2">
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
            onHighlight={onHighlight}
          />
          <PlayerWordSection
            username={playerBUsername}
            words={entry.playerB.words}
            roundNumber={entry.roundNumber}
            onHighlight={onHighlight}
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
  playerASlotId,
  biggestSwing,
  highestWord,
  onHighlight,
}: RoundHistoryPanelProps) {
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(() => new Set());

  // Map each callout to the slot of the player it concerns, so we can tint
  // it in that player's brand color (issue #209 follow-up).
  const swingSlot: "player_a" | "player_b" = biggestSwing?.favoredPlayerId === "player-b"
    ? "player_b"
    : "player_a";
  const topWordSlot: "player_a" | "player_b" =
    playerASlotId && highestWord && highestWord.playerId !== playerASlotId
      ? "player_b"
      : "player_a";
  const swingClasses = SLOT_CALLOUT_CLASSES[swingSlot];
  const topWordClasses = SLOT_CALLOUT_CLASSES[topWordSlot];

  const allExpanded = useMemo(
    () => rounds.length > 0 && expandedRounds.size === rounds.length,
    [rounds.length, expandedRounds.size],
  );

  const toggleRound = (roundNumber: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundNumber)) {
        next.delete(roundNumber);
      } else {
        next.add(roundNumber);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setExpandedRounds(
      allExpanded ? new Set() : new Set(rounds.map((r) => r.roundNumber)),
    );
  };

  return (
    <div className="space-y-3" data-testid="round-history-panel">
      {(biggestSwing !== undefined || highestWord !== undefined) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {biggestSwing ? (
            <div
              className={`rounded-xl border px-4 py-3 ${swingClasses.container}`}
              data-testid="callout-biggest-swing"
            >
              <p className={`text-xs font-semibold uppercase tracking-wider ${swingClasses.label}`}>
                Biggest swing
              </p>
              <p className="mt-1 text-sm text-ink">
                Round {biggestSwing.roundNumber}{" "}
                <span className="text-ink-soft">(±{biggestSwing.swingAmount} pts)</span>
              </p>
            </div>
          ) : (
            biggestSwing === null && (
              <div
                className="rounded-xl border border-hair bg-paper-2 px-4 py-3 text-sm text-ink-soft"
                data-testid="callout-no-swing"
              >
                No scoring swings
              </div>
            )
          )}
          {highestWord ? (
            <div
              className={`rounded-xl border px-4 py-3 ${topWordClasses.container}`}
              data-testid="callout-highest-word"
            >
              <p className={`text-xs font-semibold uppercase tracking-wider ${topWordClasses.label}`}>
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
              <div
                className="rounded-xl border border-hair bg-paper-2 px-4 py-3 text-sm text-ink-soft"
                data-testid="callout-no-word"
              >
                No scored words
              </div>
            )
          )}
        </div>
      )}

      {rounds.length === 0 ? (
        <p
          className="py-8 text-center text-sm text-ink-soft"
          data-testid="round-history-empty"
        >
          No rounds completed.
        </p>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wider text-ink-soft transition hover:bg-paper-2 hover:text-ink"
              data-testid="round-history-toggle-all"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          </div>
          {/* Scrollable rounds list — keeps the panel's outer height bounded so
           *  expanding rounds reveals an internal scrollbar instead of growing
           *  the page (and pushing the board out of view post-game). */}
          <div
            className="max-h-[60vh] space-y-3 overflow-y-auto pr-1"
            data-testid="round-history-list"
          >
          {rounds.map((entry) => (
            <RoundRow
              key={entry.roundNumber}
              entry={entry}
              expanded={expandedRounds.has(entry.roundNumber)}
              onToggle={() => toggleRound(entry.roundNumber)}
              playerAUsername={playerAUsername}
              playerBUsername={playerBUsername}
              onHighlight={onHighlight}
            />
          ))}
          </div>
        </>
      )}
    </div>
  );
}
