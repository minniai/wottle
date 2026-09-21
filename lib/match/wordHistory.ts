import { mapWordScoreRow, type WordScoreEntryRow } from "@/lib/match/wordScoreRow";
import type { getServiceRoleClient } from "@/lib/supabase/server";
import type { WordScore } from "@/lib/types/match";

type Supabase = ReturnType<typeof getServiceRoleClient>;

/** One scored word of a resolved move, as the ledger and the field draw it (spec 050). */
export interface HistoryWord extends WordScore {
  /** The mover's Nth resolved move: the ledger row it belongs to. */
  moveSeq: number;
  /** Receipt order across both players. */
  globalSeq: number;
}

export interface MatchWordHistory {
  matchId: string;
  words: HistoryWord[];
}

type MoveRef = { id: string; seq: number | null; global_seq: number };
type HistoryRow = WordScoreEntryRow & { move_id: string };

/**
 * Every scored word of every resolved move, in receipt order (spec 050).
 * Served once per mount, rematch or missed broadcast by
 * `GET /api/match/[matchId]/words` — never on the move path.
 */
export async function loadMatchWordHistory(client: Supabase, matchId: string): Promise<HistoryWord[]> {
  const moves = await loadResolvedMoves(client, matchId);
  if (moves.length === 0) return [];
  const rows = await loadEntries(client, matchId, moves.map((m) => m.id));
  const moveOf = new Map(moves.map((m) => [m.id, m]));
  return rows
    .map((row) => toHistoryWord(row, moveOf.get(row.move_id)))
    .sort((a, b) => a.globalSeq - b.globalSeq || a.word.localeCompare(b.word));
}

async function loadResolvedMoves(client: Supabase, matchId: string): Promise<MoveRef[]> {
  const { data, error } = await client
    .from("match_moves")
    .select("id, seq, global_seq")
    .eq("match_id", matchId)
    .eq("status", "resolved");
  if (error) throw new Error(`Failed to load moves: ${error.message}`);
  return (data ?? []) as MoveRef[];
}

async function loadEntries(client: Supabase, matchId: string, moveIds: string[]): Promise<HistoryRow[]> {
  const { data, error } = await client
    .from("word_score_entries")
    .select("move_id, player_id, word, length, letters_points, bonus_points, total_points, tiles")
    .eq("match_id", matchId)
    .in("move_id", moveIds);
  if (error) throw new Error(`Failed to load word history: ${error.message}`);
  return (data ?? []) as HistoryRow[];
}

function toHistoryWord(row: HistoryRow, move: MoveRef | undefined): HistoryWord {
  return { ...mapWordScoreRow(row), moveSeq: move?.seq ?? 0, globalSeq: move?.global_seq ?? 0 };
}
