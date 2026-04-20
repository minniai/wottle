import type { RecentGameRow } from "@/lib/types/lobby";

interface RecentGamesCardProps {
  games: RecentGameRow[];
}

const RESULT_LABEL: Record<"win" | "loss" | "draw", string> = {
  win: "W",
  loss: "L",
  draw: "D",
};

const RESULT_STYLE: Record<"win" | "loss" | "draw", string> = {
  win: "bg-good/20 text-good",
  loss: "bg-bad/15 text-bad",
  draw: "bg-paper-3 text-ink-3",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "just now";
  const hours = diffMs / (60 * 60 * 1000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function RecentGamesCard({ games }: RecentGamesCardProps) {
  return (
    <div
      data-testid="recent-games-card"
      className="rounded-xl border border-hair bg-paper shadow-wottle-sm"
    >
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h3 className="font-display text-[18px] italic text-ink">
          Your recent games
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          Last 7 days
        </span>
      </div>
      {games.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">
          No recent games. Start one from the floor above.
        </p>
      ) : (
        <div>
          {games.map((g) => (
            <div
              key={g.matchId}
              data-testid="recent-game-row"
              className="grid items-center gap-3 border-b border-hair/60 px-4 py-2.5 last:border-b-0"
              style={{
                gridTemplateColumns: "34px 1fr auto auto auto",
              }}
            >
              <span
                className={`inline-flex h-7 items-center justify-center rounded font-mono text-[11px] font-medium uppercase ${RESULT_STYLE[g.result]}`}
              >
                {RESULT_LABEL[g.result]}
              </span>
              <span className="truncate text-[13px] text-ink-3">
                vs <b className="text-ink">@{g.opponentUsername}</b>
              </span>
              <span className="font-mono text-[12px] text-ink-soft">
                {g.yourScore} – {g.opponentScore}
              </span>
              <span className="font-mono text-[12px] text-ink-soft">
                {g.wordsFound} words
              </span>
              <span className="font-mono text-[11px] text-ink-soft">
                {relativeTime(g.completedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
