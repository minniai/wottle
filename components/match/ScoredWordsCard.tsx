"use client";

import type { WordHistoryRow } from "@/components/match/FinalSummary";

export interface ScoredWordRound {
  roundNumber: number;
  words: WordHistoryRow[];
}

/**
 * Group a player's scored words by round, newest round first. Every completed
 * round is represented even if the player scored nothing in it, so the log shows
 * a "no words" entry rather than silently skipping the round.
 */
export function buildScoredWordRounds(
  accumulatedWords: WordHistoryRow[],
  playerId: string,
  completedRounds: number[],
): ScoredWordRound[] {
  const byRound = new Map<number, WordHistoryRow[]>();
  for (const round of completedRounds) {
    byRound.set(round, []);
  }
  for (const word of accumulatedWords) {
    if (word.playerId !== playerId) continue;
    if (!byRound.has(word.roundNumber)) {
      byRound.set(word.roundNumber, []);
    }
    byRound.get(word.roundNumber)!.push(word);
  }
  return Array.from(byRound.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([roundNumber, words]) => ({ roundNumber, words }));
}

interface ScoredWordsCardProps {
  title: string;
  playerId: string;
  accumulatedWords: WordHistoryRow[];
  completedRounds: number[];
  playerColor: string;
}

export function ScoredWordsCard({
  title,
  playerId,
  accumulatedWords,
  completedRounds,
  playerColor,
}: ScoredWordsCardProps) {
  const rounds = buildScoredWordRounds(
    accumulatedWords,
    playerId,
    completedRounds,
  );

  return (
    <div
      data-testid="scored-words-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: playerColor }}
        />
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          {title}
        </div>
      </div>

      {rounds.length === 0 ? (
        <p
          data-testid="scored-words-empty"
          className="mt-2.5 text-[13px] italic leading-[1.6] text-ink-soft/70"
        >
          No words yet
        </p>
      ) : (
        <div className="mt-2 max-h-56 overflow-y-auto">
          {rounds.map((entry) => (
            <div
              key={entry.roundNumber}
              className="border-t border-hair py-1.5 first:border-t-0"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Round {entry.roundNumber}
              </p>
              {entry.words.length === 0 ? (
                <p className="text-[11px] italic text-ink-soft/50">no words</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {entry.words.map((word, index) => (
                    <li
                      key={`${word.word}-${index}`}
                      className="flex items-center justify-between text-[13px] text-ink-3"
                    >
                      <span className="font-mono uppercase tracking-wide">
                        {word.word}
                      </span>
                      <span className="text-ink-soft">+{word.totalPoints}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
