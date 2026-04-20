import { PlayerAvatar } from "@/components/match/PlayerAvatar";
import type { TopPlayerRow } from "@/lib/types/lobby";

interface TopOfBoardCardProps {
  players: TopPlayerRow[];
  seasonLabel?: string;
}

function formatRating(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function TopOfBoardCard({
  players,
  seasonLabel = "Season 1",
}: TopOfBoardCardProps) {
  return (
    <div
      data-testid="top-of-board-card"
      className="rounded-xl border border-hair bg-paper shadow-wottle-sm"
    >
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h3 className="font-display text-[18px] italic text-ink">
          Top of the board
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          {seasonLabel}
        </span>
      </div>
      {players.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">
          Nobody on the leaderboard yet.
        </p>
      ) : (
        <div>
          {players.map((p, idx) => (
            <div
              key={p.id}
              data-testid="top-of-board-row"
              className="grid items-center gap-3 border-b border-hair/60 px-4 py-2.5 last:border-b-0"
              style={{ gridTemplateColumns: "18px 34px 1fr auto" }}
            >
              <span className="font-mono text-[11px] text-ink-soft">
                {idx + 1}
              </span>
              <PlayerAvatar
                displayName={p.displayName}
                avatarUrl={p.avatarUrl}
                playerColor={
                  idx % 2 === 0 ? "oklch(0.68 0.14 60)" : "oklch(0.56 0.08 220)"
                }
                size="sm"
              />
              <span className="truncate text-[13px] text-ink">
                {p.displayName}
              </span>
              <span className="font-mono text-[13px] text-ink">
                {formatRating(p.eloRating)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
