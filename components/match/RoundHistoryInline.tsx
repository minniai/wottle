"use client";

import type { WordHistoryRow } from "@/components/match/FinalSummary";

interface RoundEntry {
  roundNumber: number;
  words: WordHistoryRow[];
}

interface RoundHistoryInlineProps {
  playerId: string;
  accumulatedWords: WordHistoryRow[];
  totalRounds: number;
  currentRound: number;
}

function groupByRound(
  words: WordHistoryRow[],
  playerId: string,
): RoundEntry[] {
  const byRound = new Map<number, WordHistoryRow[]>();
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
  totalRounds,
  currentRound,
}: RoundHistoryInlineProps) {
  const rounds = groupByRound(accumulatedWords, playerId);

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-2 max-h-40 overflow-y-auto"
      data-testid="round-history-inline"
    >
      {rounds.map((entry) => (
        <div
          key={entry.roundNumber}
          className="border-t border-white/10 py-1.5 first:border-t-0"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/40">
            Round {entry.roundNumber}
            {entry.roundNumber === currentRound - 1 && totalRounds > 1
              ? ""
              : ""}
          </p>
          {entry.words.length === 0 ? (
            <p className="text-[0.6rem] italic text-white/30">
              no words
            </p>
          ) : (
            <ul className="space-y-0.5">
              {entry.words.map((w, i) => (
                <li
                  key={`${w.word}-${i}`}
                  className="flex items-center justify-between text-[0.7rem] text-white/70"
                >
                  <span className="font-mono uppercase tracking-wide">
                    {w.word}
                  </span>
                  <span className="text-white/50">
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
