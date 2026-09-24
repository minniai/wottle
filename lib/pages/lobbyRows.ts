import type { Copy } from "@/lib/i18n/copy/types";
import type { HeadToHead, LobbyRow, PresenceState } from "@/lib/types/standing";

/**
 * The here-now table (spec 070 US2.2–US2.3, game flow B1). Pure: the order the
 * table keeps, what each row says and whether it can be challenged. Standing
 * overlays (sent, an outcome, a cooldown) are applied by the caller (US3).
 */
const STATE_ORDER: Record<PresenceState, number> = { here: 0, searching: 1, in_match: 2, away: 3 };
const VISIBLE_ROWS = 8;
const MOVE_LIMIT = 10;

function sortKey(viewerRating: number) {
  return (a: LobbyRow, b: LobbyRow): number =>
    STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
    Math.abs(a.rating - viewerRating) - Math.abs(b.rating - viewerRating) ||
    a.displayName.localeCompare(b.displayName);
}

/** While frozen (pointer or focus inside, or a composer open) the order holds; arrivals go last. */
export function orderRows(rows: LobbyRow[], viewerRating: number, frozenOrder: string[] | null): LobbyRow[] {
  if (!frozenOrder) return [...rows].sort(sortKey(viewerRating));
  const byId = new Map(rows.map((r) => [r.playerId, r]));
  const kept = frozenOrder.map((id) => byId.get(id)).filter((r): r is LobbyRow => Boolean(r));
  const known = new Set(frozenOrder);
  return [...kept, ...rows.filter((r) => !known.has(r.playerId))];
}

export function recordText(record: HeadToHead | null): string {
  if (!record || record.wins + record.losses + record.draws === 0) return "—";
  return record.draws > 0 ? `${record.wins}–${record.losses}–${record.draws}` : `${record.wins}–${record.losses}`;
}

export type RowAction = { kind: "challenge"; label: string } | { kind: "none" };

export interface RowModel {
  playerId: string;
  name: string;
  handle: string;
  rating: number;
  record: string;
  status: string;
  muted: boolean;
  action: RowAction;
}

function statusWord(row: LobbyRow, copy: Copy): string {
  switch (row.state) {
    case "here":
      return copy.pages.HERE;
    case "searching":
      return copy.pages.SEARCHING;
    case "in_match":
      return copy.pages.inMatch(row.movesPlayed ?? 0, MOVE_LIMIT);
    case "away":
      return copy.pages.AWAY;
  }
}

export function rowModel(row: LobbyRow, copy: Copy): RowModel {
  const challengeable = row.state === "here" || row.state === "searching";
  return {
    playerId: row.playerId,
    name: row.displayName,
    handle: row.handle,
    rating: row.rating,
    record: recordText(row.record),
    status: statusWord(row, copy),
    muted: !challengeable,
    action: challengeable ? { kind: "challenge", label: copy.pages.rowAction(row.displayName) } : { kind: "none" },
  };
}

/** Eight rows, then `+ 6 more ▸`, which expands in place. */
export function visibleRows<T>(rows: T[], expanded: boolean): { shown: T[]; more: number } {
  if (expanded || rows.length <= VISIBLE_ROWS) return { shown: rows, more: 0 };
  return { shown: rows.slice(0, VISIBLE_ROWS), more: rows.length - VISIBLE_ROWS };
}
