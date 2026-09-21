import type { SupabaseClient } from "@supabase/supabase-js";

import type { FrozenTileMap } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";
import { trackMatchIntegrityFailed } from "@/lib/observability/log";
import {
  letterAtFreeze,
  verifyMatchIntegrity,
  type IntegrityRecord,
  type MatchIntegrityFailure,
  type MoveBoard,
} from "./matchIntegrity";

type AnyClient = SupabaseClient<any, any, any>;

export interface MoveIntegrityInput {
  matchId: string;
  /** The move just finished; its board is `board`, already persisted by `finish_move`. */
  globalSeq: number;
  board: string[][];
  frozenTiles: FrozenTileMap;
}

type MoveRow = { id: string; global_seq: number; board_after: unknown };
type RecordRow = { id: string; move_id: string; word: string; tiles: Coordinate[] | null };

/**
 * The post-resolution integrity check (spec 049 contracts/integrity-check.md,
 * per move since spec 050): one read of the match's resolved moves and
 * records, then `verifyMatchIntegrity` on the board just written. Failures
 * are logged as `match.integrity.failed` and returned. Never throws: a failed
 * read is logged and treated as "nothing to report".
 */
export async function checkMoveIntegrity(
  supabase: AnyClient,
  input: MoveIntegrityInput,
): Promise<MatchIntegrityFailure[]> {
  try {
    const moves = await loadMoveBoards(supabase, input);
    const records = await loadRecords(supabase, input.matchId, moves);
    const failures = verifyMatchIntegrity({
      board: input.board,
      records,
      frozenTiles: input.frozenTiles,
      letterAtFreeze: letterAtFreeze(moves, records),
    });
    if (failures.length > 0) {
      trackMatchIntegrityFailed({ matchId: input.matchId, globalSeq: input.globalSeq, failures });
    }
    return failures;
  } catch (error) {
    console.error("[integrityCheck] could not run the check:", error);
    return [];
  }
}

async function loadMoveBoards(supabase: AnyClient, input: MoveIntegrityInput): Promise<(MoveBoard & { id: string })[]> {
  const { data, error } = await supabase
    .from("match_moves")
    .select("id, global_seq, board_after")
    .eq("match_id", input.matchId)
    .eq("status", "resolved")
    .lte("global_seq", input.globalSeq);
  if (error) throw new Error(`Failed to load moves: ${error.message}`);
  return ((data ?? []) as MoveRow[]).map((row) => ({
    id: row.id,
    globalSeq: row.global_seq,
    boardAfter:
      row.global_seq === input.globalSeq ? input.board : ((row.board_after as string[][] | null) ?? null),
  }));
}

async function loadRecords(
  supabase: AnyClient,
  matchId: string,
  moves: (MoveBoard & { id: string })[],
): Promise<IntegrityRecord[]> {
  const { data, error } = await supabase
    .from("word_score_entries")
    .select("id, move_id, word, tiles")
    .eq("match_id", matchId);
  if (error) throw new Error(`Failed to load records: ${error.message}`);
  const seqOf = new Map(moves.map((m) => [m.id, m.globalSeq]));
  return ((data ?? []) as RecordRow[])
    .filter((row) => seqOf.has(row.move_id))
    .map((row) => ({ id: row.id, word: row.word, globalSeq: seqOf.get(row.move_id) as number, tiles: row.tiles ?? [] }));
}
