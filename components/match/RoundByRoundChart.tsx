import type { CSSProperties } from "react";

import type { ScoreboardRow } from "@/components/match/FinalSummary";

interface RoundByRoundChartProps {
  rounds: ScoreboardRow[];
  maxHeightPx?: number;
  /**
   * When false, the current viewer is player B, so player B's bar is drawn on
   * top to keep "current player first" consistent with the rest of the summary
   * (O-72). Each player's bar keeps its own slot color and `data-delta`
   * regardless of vertical position. Defaults to true (spectator / player A).
   */
  currentIsPlayerA?: boolean;
}

interface BarSpec {
  testid: "round-chart-bar--a" | "round-chart-bar--b";
  delta: number;
  colorClass: string;
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
  currentIsPlayerA = true,
}: RoundByRoundChartProps) {
  const scale = maxAbsDelta(rounds);
  const toHeight = (delta: number): number =>
    scale === 0 ? 0 : Math.round((Math.abs(delta) / scale) * maxHeightPx);

  const renderBar = (spec: BarSpec, position: "top" | "bottom") => {
    const height = toHeight(spec.delta);
    const rounding = position === "top" ? "rounded-t" : "rounded-b";
    const labelEdge = position === "top" ? "top-0.5" : "bottom-0.5";
    return (
      <div
        data-testid={spec.testid}
        data-delta={spec.delta}
        className={`relative w-full ${rounding} ${spec.colorClass}`}
        style={{ height: `${height}px` }}
      >
        {spec.delta > 0 && height >= LABEL_MIN_BAR_PX ? (
          <span
            className={`absolute inset-x-0 ${labelEdge} text-center font-mono text-[9px] leading-none text-ink/90`}
          >
            {spec.delta}
          </span>
        ) : null}
      </div>
    );
  };

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
          const aSpec: BarSpec = {
            testid: "round-chart-bar--a",
            delta: row.playerADelta,
            colorClass: "bg-p1",
          };
          const bSpec: BarSpec = {
            testid: "round-chart-bar--b",
            delta: row.playerBDelta,
            colorClass: "bg-p2 opacity-70",
          };
          // Current player's bar sits on top so "current player first" holds.
          const topSpec = currentIsPlayerA ? aSpec : bSpec;
          const bottomSpec = currentIsPlayerA ? bSpec : aSpec;
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
                {renderBar(topSpec, "top")}
              </div>
              <div
                className="flex w-full flex-col"
                style={{ height: `${maxHeightPx}px` }}
              >
                {renderBar(bottomSpec, "bottom")}
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
