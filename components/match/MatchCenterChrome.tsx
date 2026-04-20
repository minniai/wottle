"use client";

import { RoundPipBar } from "./RoundPipBar";

type MatchStatus = "your-move" | "waiting" | "resolving";

interface MatchCenterChromeProps {
  currentRound: number;
  totalRounds: number;
  status: MatchStatus;
}

const STATUS_LABELS: Record<MatchStatus, string> = {
  "your-move": "YOUR MOVE · SWAP TWO TILES",
  waiting: "WAITING FOR OPPONENT",
  resolving: "RESOLVING ROUND",
};

export function MatchCenterChrome({
  currentRound,
  totalRounds,
  status,
}: MatchCenterChromeProps) {
  return (
    <div
      data-testid="match-center-chrome"
      className="flex flex-col items-center gap-2.5 px-4"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        Round {currentRound} / {totalRounds}
      </span>
      <RoundPipBar current={currentRound} total={totalRounds} />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}
