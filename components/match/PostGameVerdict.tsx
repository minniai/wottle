interface PostGameVerdictProps {
  outcome: "win" | "loss" | "draw";
  totalRounds: number;
  durationMs: number;
  pointMargin: number;
  opponentName: string;
  reasonLabel: string;
  /**
   * When set, renders third-person labels for a spectator viewing someone
   * else's match. `subjectName` is the player whose POV `outcome` is from
   * (player_a on the summary page); `opponentName` stays as the other player.
   */
  subjectName?: string;
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

function headlineLabel(
  outcome: "win" | "loss" | "draw",
  subjectName: string | undefined,
  opponentName: string,
): string {
  if (subjectName === undefined) {
    return outcome === "win" ? "Victory." : outcome === "loss" ? "Defeat." : "Draw.";
  }
  if (outcome === "draw") return "Draw.";
  return `${outcome === "win" ? subjectName : opponentName} won.`;
}

function subDisplayText(
  outcome: "win" | "loss" | "draw",
  pointMargin: number,
  opponentName: string,
  subjectName: string | undefined,
): string {
  const points = `${pointMargin} point${pointMargin === 1 ? "" : "s"}`;
  if (subjectName !== undefined) {
    if (outcome === "win") return `${subjectName} out-read ${opponentName} by ${points}.`;
    if (outcome === "loss") return `${opponentName} out-read ${subjectName} by ${points}.`;
    return `${subjectName} and ${opponentName} tied after the final round.`;
  }
  if (outcome === "win") return `You out-read ${opponentName} by ${points}.`;
  if (outcome === "loss") return `${opponentName} out-read you by ${points}.`;
  return `Tied with ${opponentName} after the final round.`;
}

export function PostGameVerdict({
  outcome,
  totalRounds,
  durationMs,
  pointMargin,
  opponentName,
  reasonLabel,
  subjectName,
}: PostGameVerdictProps) {
  return (
    <div data-testid="post-game-verdict" className={OUTCOME_CLASS[outcome]}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        Match complete · {totalRounds} rounds · {formatDuration(durationMs)}
      </p>
      <h1 className="mt-3 font-display text-[72px] italic leading-none tracking-tight">
        {headlineLabel(outcome, subjectName, opponentName)}
      </h1>
      <p className="mt-2 font-display text-[22px] italic text-ink-3">
        {subDisplayText(outcome, pointMargin, opponentName, subjectName)}
      </p>
      <p className="mt-2 text-sm text-ink-soft">{reasonLabel}</p>
    </div>
  );
}
