import type { CSSProperties } from "react";

import type { ScoreboardRow } from "@/components/match/FinalSummary";

interface RoundByRoundChartProps {
  rounds: ScoreboardRow[];
  maxHeightPx?: number;
}

const DEFAULT_MAX_HEIGHT = 120;
const LABEL_MIN_BAR_PX = 14;

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
      <div className="relative flex items-stretch justify-between gap-1">
        <div
          data-testid="round-chart-zero-line"
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-px bg-ink-soft/25"
          style={{ top: `${maxHeightPx}px` }}
        />
        {rounds.map((row) => {
          const aH = toHeight(row.playerADelta);
          const bH = toHeight(row.playerBDelta);
          return (
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
                  className="relative w-full rounded-t bg-p1"
                  style={{ height: `${aH}px` }}
                >
                  {row.playerADelta > 0 && aH >= LABEL_MIN_BAR_PX ? (
                    <span className="absolute inset-x-0 top-0.5 text-center font-mono text-[9px] leading-none text-white/90">
                      {row.playerADelta}
                    </span>
                  ) : null}
                </div>
              </div>
              <div
                className="flex w-full flex-col"
                style={{ height: `${maxHeightPx}px` }}
              >
                <div
                  data-testid="round-chart-bar--b"
                  data-delta={row.playerBDelta}
                  className="relative w-full rounded-b bg-p2 opacity-70"
                  style={{ height: `${bH}px` }}
                >
                  {row.playerBDelta > 0 && bH >= LABEL_MIN_BAR_PX ? (
                    <span className="absolute inset-x-0 bottom-0.5 text-center font-mono text-[9px] leading-none text-white/90">
                      {row.playerBDelta}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="mt-1 font-mono text-[10px] text-ink-soft">
                R{row.roundNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
