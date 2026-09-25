import type { RecentGameRow } from "@/lib/types/lobby";

const ROWS_UNDER_MAP = 3;

/** The rows under the drawn last match (2026-09-25): the next three, never the one already drawn. */
export function rowsAfter(recent: RecentGameRow[], drawnId: string): RecentGameRow[] {
  return recent.filter((g) => g.matchId !== drawnId).slice(0, ROWS_UNDER_MAP);
}
