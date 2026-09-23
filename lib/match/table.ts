import type { MatchTable, TableOrigin, VoidReason } from "@/lib/types/match";

/** The `matches` columns the table reads (spec 069, data-model.md). */
export interface TableRow {
  player_a_seated_at: string | null;
  player_b_seated_at: string | null;
  table_deadline_at: string | null;
  origin: string | null;
  rematch_of: string | null;
  void_reason: string | null;
  voided_by: string | null;
}

export const TABLE_COLUMNS = "player_a_seated_at,player_b_seated_at,table_deadline_at,origin,rematch_of,void_reason,voided_by";

/** A table both players sat at: every match that started. Fixtures and snapshots of live matches use it. */
export const SEATED_TABLE: MatchTable = Object.freeze({
  seats: { a: "2026-09-23T12:00:00.000Z", b: "2026-09-23T12:00:00.000Z" },
  deadlineAt: "2026-09-23T12:00:20.000Z",
  origin: "queue",
  rematchOf: null,
  voidReason: null,
  voidedBy: null,
}) as MatchTable;

export function tableOf(row: TableRow): MatchTable {
  return {
    seats: { a: row.player_a_seated_at, b: row.player_b_seated_at },
    deadlineAt: row.table_deadline_at,
    origin: (row.origin as TableOrigin | null) ?? null,
    rematchOf: row.rematch_of,
    voidReason: (row.void_reason as VoidReason | null) ?? null,
    voidedBy: row.voided_by,
  };
}
