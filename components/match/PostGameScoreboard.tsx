import { PlayerAvatar } from "@/components/match/PlayerAvatar";
import { getPlayerColors } from "@/lib/constants/playerColors";

type Slot = "player_a" | "player_b";

export interface ScoreboardEntry {
  id: string;
  displayName: string;
  slot: Slot;
  score: number;
  wordsCount: number;
  frozenTileCount: number;
  bestWord: string | null;
  ratingDelta: number | undefined;
  isCurrentPlayer: boolean;
  isWinner: boolean;
}

interface PostGameScoreboardProps {
  entries: [ScoreboardEntry, ScoreboardEntry];
}

function ratingLabel(delta: number | undefined): string {
  if (delta === undefined) return "Rating pending";
  if (delta === 0) return "±0 rating";
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  return `${sign}${abs} rating`;
}

function Card({ entry }: { entry: ScoreboardEntry }) {
  const cardClass =
    entry.slot === "player_a" ? "hud-card hud-card--you" : "hud-card hud-card--opp";
  const scoreClass =
    entry.slot === "player_a" ? "text-p1-deep" : "text-p2-deep";
  const { hex: avatarColor } = getPlayerColors(entry.slot);

  return (
    <div
      data-testid="post-game-scoreboard-card"
      className={`${cardClass} flex-col !items-start gap-3`}
    >
      <div className="flex w-full items-center gap-3">
        <PlayerAvatar
          displayName={entry.displayName}
          avatarUrl={null}
          playerColor={avatarColor}
          size="md"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium text-ink">
            {entry.displayName}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
            {ratingLabel(entry.ratingDelta)}
          </span>
        </div>
      </div>
      <span
        className={`font-display text-[56px] italic leading-none ${scoreClass}`}
        data-testid="post-game-scoreboard-score"
      >
        {entry.score}
      </span>
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span>{entry.wordsCount} words</span>
        <span aria-hidden="true">·</span>
        <span>{entry.frozenTileCount} frozen</span>
        <span aria-hidden="true">·</span>
        <span>
          best{" "}
          <b className="font-mono font-medium text-ink">
            {entry.bestWord ?? "—"}
          </b>
        </span>
      </div>
    </div>
  );
}

export function PostGameScoreboard({ entries }: PostGameScoreboardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card entry={entries[0]} />
      <Card entry={entries[1]} />
    </div>
  );
}
