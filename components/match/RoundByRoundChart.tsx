import type { CSSProperties } from "react";

import type { ScoreboardRow } from "@/components/match/FinalSummary";

interface RoundByRoundChartProps {
  rounds: ScoreboardRow[];
  maxHeightPx?: number;
}

const DEFAULT_MAX_HEIGHT = 120;

function maxAbsDelta(rounds: ScoreboardRow[]): number {
  let m = 0;
  for (const r of rounds) {
    if (Math.abs(r.playerADelta) > m) m = Math.abs(r.playerADelta);
    if (Math.abs(r.playerBDelta) > m) m = Math.abs(r.playerBDelta);
  }
  return m;
}

export function RoundByRoundChart({
  rounds,
  maxHeightPx = DEFAULT_MAX_HEIGHT,
}: RoundByRoundChartProps) {
  const scale = maxAbsDelta(rounds);
  const toHeight = (delta: number): number =>
    scale === 0 ? 0 : Math.round((Math.abs(delta) / scale) * maxHeightPx);

  return (
    <div
      data-testid="round-by-round-chart"
      className="w-full"
      style={{ "--chart-col": `${maxHeightPx}px` } as CSSProperties}
    >
      <div className="flex items-stretch justify-between gap-1">
        {rounds.map((row) => (
          <div
            key={row.roundNumber}
            data-testid="round-chart-col"
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            <div
              className="flex w-full flex-col justify-end"
              style={{ height: `${maxHeightPx}px` }}
            >
              <div
                data-testid="round-chart-bar--a"
                data-delta={row.playerADelta}
                className="w-full rounded-t bg-p1"
                style={{ height: `${toHeight(row.playerADelta)}px` }}
              />
            </div>
            <div
              className="flex w-full flex-col"
              style={{ height: `${maxHeightPx}px` }}
            >
              <div
                data-testid="round-chart-bar--b"
                data-delta={row.playerBDelta}
                className="w-full rounded-b bg-p2 opacity-70"
                style={{ height: `${toHeight(row.playerBDelta)}px` }}
              />
            </div>
            <span className="mt-1 font-mono text-[10px] text-ink-soft">
              R{row.roundNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
