"use client";

import type { WordHistoryRow } from "@/components/match/FinalSummary";

interface RoundEntry {
  roundNumber: number;
  words: WordHistoryRow[];
}

interface RoundHistoryInlineProps {
  playerId: string;
  accumulatedWords: WordHistoryRow[];
  completedRounds: number[];
}

function buildRounds(
  words: WordHistoryRow[],
  playerId: string,
  completedRounds: number[],
): RoundEntry[] {
  const byRound = new Map<number, WordHistoryRow[]>();
  for (const r of completedRounds) {
    byRound.set(r, []);
  }
  for (const w of words) {
    if (w.playerId !== playerId) continue;
    if (!byRound.has(w.roundNumber)) {
      byRound.set(w.roundNumber, []);
    }
    byRound.get(w.roundNumber)!.push(w);
  }
  return Array.from(byRound.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([roundNumber, ws]) => ({ roundNumber, words: ws }));
}

export function RoundHistoryInline({
  playerId,
  accumulatedWords,
  completedRounds,
}: RoundHistoryInlineProps) {
  const rounds = buildRounds(accumulatedWords, playerId, completedRounds);

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-2 w-full max-h-40 overflow-y-auto"
      data-testid="round-history-inline"
    >
      {rounds.map((entry) => (
        <div
          key={entry.roundNumber}
          className="border-t border-hair py-1.5 first:border-t-0"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-soft">
            Round {entry.roundNumber}
          </p>
          {entry.words.length === 0 ? (
            <p className="text-[0.6rem] italic text-ink-soft/50">
              no words
            </p>
          ) : (
            <ul className="space-y-0.5">
              {entry.words.map((w, i) => (
                <li
                  key={`${w.word}-${i}`}
                  className="flex items-center justify-between text-[0.7rem] text-ink-3"
                >
                  <span className="font-mono uppercase tracking-wide">
                    {w.word}
                  </span>
                  <span className="text-ink-soft">
                    +{w.totalPoints}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
