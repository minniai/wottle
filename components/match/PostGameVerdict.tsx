interface PostGameVerdictProps {
  outcome: "win" | "loss" | "draw";
  totalRounds: number;
  durationMs: number;
  pointMargin: number;
  opponentName: string;
  reasonLabel: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

const OUTCOME_CLASS: Record<"win" | "loss" | "draw", string> = {
  win: "post-game-verdict--win text-p1-deep",
  loss: "post-game-verdict--loss text-p2-deep",
  draw: "post-game-verdict--draw text-ink",
};

const OUTCOME_LABEL: Record<"win" | "loss" | "draw", string> = {
  win: "Victory.",
  loss: "Defeat.",
  draw: "Draw.",
};

function subDisplayText(
  outcome: "win" | "loss" | "draw",
  pointMargin: number,
  opponentName: string,
): string {
  if (outcome === "win") {
    return `You out-read ${opponentName} by ${pointMargin} point${pointMargin === 1 ? "" : "s"}.`;
  }
  if (outcome === "loss") {
    return `${opponentName} out-read you by ${pointMargin} point${pointMargin === 1 ? "" : "s"}.`;
  }
  return `Tied with ${opponentName} after the final round.`;
}

export function PostGameVerdict({
  outcome,
  totalRounds,
  durationMs,
  pointMargin,
  opponentName,
  reasonLabel,
}: PostGameVerdictProps) {
  return (
    <div data-testid="post-game-verdict" className={OUTCOME_CLASS[outcome]}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        Match complete · {totalRounds} rounds · {formatDuration(durationMs)}
      </p>
      <h1 className="mt-3 font-display text-[72px] italic leading-none tracking-tight">
        {OUTCOME_LABEL[outcome]}
      </h1>
      <p className="mt-2 font-display text-[22px] italic text-ink-3">
        {subDisplayText(outcome, pointMargin, opponentName)}
      </p>
      <p className="mt-2 text-sm text-ink-soft">{reasonLabel}</p>
    </div>
  );
}
