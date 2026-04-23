import type { WordHistoryRow } from "@/components/match/FinalSummary";

interface WordsOfMatchProps {
  wordHistory: WordHistoryRow[];
  playerASlotId: string;
  maxHeightPx?: number;
}

const DEFAULT_MAX_HEIGHT = 320;

export function WordsOfMatch({
  wordHistory,
  playerASlotId,
  maxHeightPx = DEFAULT_MAX_HEIGHT,
}: WordsOfMatchProps) {
  const sorted = [...wordHistory].sort((a, b) => a.roundNumber - b.roundNumber);

  return (
    <div
      data-testid="words-of-match"
      className="rounded-xl border border-hair bg-paper shadow-wottle-sm h-full"
    >
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h3 className="font-display text-[18px] italic text-ink">
          Words of the match
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          {sorted.length} found
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">
          No words scored.
        </p>
      ) : (
        <div
          style={{ height: "100%" }}
          className="overflow-y-auto"
        >
          {sorted.map((row, idx) => {
            const slotClass =
              row.playerId === playerASlotId ? "text-p1-deep" : "text-p2-deep";
            return (
              <div
                key={`${row.roundNumber}-${row.word}-${idx}`}
                data-testid="words-of-match-row"
                className={`flex items-center gap-3 border-b border-hair/60 px-4 py-2.5 ${slotClass}`}
              >
                <span className="font-display text-[17px] font-medium tracking-[0.02em]">
                  {row.word}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                  R{row.roundNumber}
                </span>
                <span className="ml-auto font-mono text-[12px] text-ink-soft">
                  +{row.totalPoints}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
