import type { Copy } from "@/lib/i18n/copy/types";
import type { SeriesView } from "@/lib/types/match";

export interface SeriesRowInput {
  matchId: string;
  winnerId: string | null;
  ordinal: number;
}

/**
 * Spec 071 (FR-018): where this match stands in its chain of rematches, seat-neutral so the
 * broadcast state can carry it. Earlier matches are all finished (a rematch needs a result);
 * this one counts once it is. A first match has no series.
 */
export function seriesViewOf(rows: SeriesRowInput[], current: { matchId: string; completed: boolean; winnerId: string | null }, playerAId: string): SeriesView | null {
  const self = rows.find((r) => r.matchId === current.matchId);
  if (!self || self.ordinal < 2) return null;
  const counted = rows.filter((r) => r.ordinal < self.ordinal).map((r) => r.winnerId);
  if (current.completed) counted.push(current.winnerId);
  const wins = { playerA: counted.filter((w) => w === playerAId).length, playerB: counted.filter((w) => w !== null && w !== playerAId).length };
  return { ordinal: self.ordinal, wins, draws: counted.filter((w) => w === null).length };
}

/** `match 2 · Birna 1–0`, or `match 3 · 1–1` when level. */
export function seriesLine(series: SeriesView, names: { playerA: string; playerB: string }, copy: Copy): string {
  const { playerA, playerB } = series.wins;
  if (playerA === playerB) return copy.seriesLine(series.ordinal, null, playerA, playerB);
  const aLeads = playerA > playerB;
  return copy.seriesLine(series.ordinal, aLeads ? names.playerA : names.playerB, Math.max(playerA, playerB), Math.min(playerA, playerB));
}
