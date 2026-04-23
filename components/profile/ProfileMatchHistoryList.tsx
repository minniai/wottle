import type { RecentGameRow } from "@/lib/types/lobby";

interface ProfileMatchHistoryListProps {
  matches: RecentGameRow[];
}

const CHIP_STYLE: Record<RecentGameRow["result"], string> = {
  win: "bg-good/25 text-good",
  loss: "bg-bad/25 text-bad",
  draw: "bg-paper-2 text-ink-3",
};
const CHIP_LABEL: Record<RecentGameRow["result"], string> = {
  win: "W",
  loss: "L",
  draw: "D",
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ProfileMatchHistoryList({ matches }: ProfileMatchHistoryListProps) {
  if (matches.length === 0) {
    return (
      <div
        data-testid="profile-match-history"
        className="px-2 py-4 text-center text-sm text-ink-soft"
      >
        No recent matches.
      </div>
    );
  }
  return (
    <ul
      data-testid="profile-match-history"
      className="flex flex-col divide-y divide-hair"
    >
      {matches.map((m) => (
        <li
          key={m.matchId}
          data-testid="match-history-row"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
        >
          <span
            data-testid={`match-history-chip-${m.matchId}`}
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-sm font-mono text-[10px] font-semibold ${CHIP_STYLE[m.result]}`}
          >
            {CHIP_LABEL[m.result]}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            vs <b className="font-semibold">@{m.opponentUsername}</b>
          </span>
          <span className="font-mono text-sm text-ink">
            {m.yourScore}–{m.opponentScore}
          </span>
          <span
            data-testid={`match-history-words-${m.matchId}`}
            className="font-mono text-[11px] text-ink-soft"
          >
            {m.wordsFound} words
          </span>
          <span className="font-mono text-[11px] text-ink-soft">
            {relativeTime(m.completedAt)}
          </span>
          <span
            aria-disabled="true"
            className="ml-auto font-mono text-[11px] text-ink-soft/60"
          >
            Replay →
          </span>
        </li>
      ))}
    </ul>
  );
}
