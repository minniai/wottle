import type { CSSProperties } from "react";

import type { ScoreboardRow } from "@/components/match/FinalSummary";

interface RoundByRoundChartProps {
  rounds: ScoreboardRow[];
  maxHeightPx?: number;
}

const DEFAULT_MAX_HEIGHT = 120;
const LABEL_MIN_BAR_PX = 14;

function maxCumulativeScore(rounds: ScoreboardRow[]): number {
  let m = 0;
  for (const r of rounds) {
    if (r.playerAScore > m) m = r.playerAScore;
    if (r.playerBScore > m) m = r.playerBScore;
  }
  return m;
}

export function RoundByRoundChart({
  rounds,
  maxHeightPx = DEFAULT_MAX_HEIGHT,
}: RoundByRoundChartProps) {
  const scale = maxCumulativeScore(rounds);
  const toHeight = (value: number): number =>
    scale === 0 ? 0 : Math.round((Math.max(0, value) / scale) * maxHeightPx);

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
          const aTotal = toHeight(row.playerAScore);
          const aDelta = toHeight(row.playerADelta);
          const bTotal = toHeight(row.playerBScore);
          const bDelta = toHeight(row.playerBDelta);
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
                  data-score={row.playerAScore}
                  className="relative w-full rounded-t bg-p1-deep"
                  style={{ height: `${aTotal}px` }}
                >
                  {row.playerADelta > 0 ? (
                    <div
                      data-testid="round-chart-bar--a-delta"
                      className="absolute inset-x-0 top-0 rounded-t bg-p1"
                      style={{ height: `${aDelta}px` }}
                    >
                      {aDelta >= LABEL_MIN_BAR_PX ? (
                        <span className="absolute inset-x-0 top-0.5 text-center font-mono text-[9px] leading-none text-white/90">
                          {row.playerADelta}
                        </span>
                      ) : null}
                    </div>
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
                  data-score={row.playerBScore}
                  className="relative w-full rounded-b bg-p2-deep opacity-70"
                  style={{ height: `${bTotal}px` }}
                >
                  {row.playerBDelta > 0 ? (
                    <div
                      data-testid="round-chart-bar--b-delta"
                      className="absolute inset-x-0 bottom-0 rounded-b bg-p2"
                      style={{ height: `${bDelta}px` }}
                    >
                      {bDelta >= LABEL_MIN_BAR_PX ? (
                        <span className="absolute inset-x-0 bottom-0.5 text-center font-mono text-[9px] leading-none text-white/90">
                          {row.playerBDelta}
                        </span>
                      ) : null}
                    </div>
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
