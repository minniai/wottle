import type { SupabaseClient } from "@supabase/supabase-js";

import type { FrozenTileMap } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";
import { trackMatchIntegrityFailed } from "@/lib/observability/log";
import {
  letterAtFreeze,
  verifyMatchIntegrity,
  type IntegrityRecord,
  type MatchIntegrityFailure,
  type RoundBoard,
} from "./matchIntegrity";

type AnyClient = SupabaseClient<any, any, any>;

export interface RoundIntegrityInput {
  matchId: string;
  /** The round just resolved; its board is `board`, not yet a persisted row it can be read from. */
  roundNumber: number;
  board: string[][];
  frozenTiles: FrozenTileMap;
}

type RoundRow = { id: string; round_number: number; board_snapshot_after: unknown };
type RecordRow = { id: string; round_id: string; word: string; tiles: Coordinate[] | null };

/**
 * The post-resolution integrity check (spec 049 contracts/integrity-check.md):
 * one read of the match's rounds and records, then `verifyMatchIntegrity` on
 * the board the caller just persisted. Failures are logged as
 * `match.integrity.failed` and returned; the caller decides the routing.
 * Never throws: a failed read is logged and treated as "nothing to report",
 * since the check must not be what stops a round.
 */
export async function checkRoundIntegrity(
  supabase: AnyClient,
  input: RoundIntegrityInput,
): Promise<MatchIntegrityFailure[]> {
  try {
    const rounds = await loadRoundBoards(supabase, input);
    const records = await loadRecords(supabase, input.matchId, rounds);
    const failures = verifyMatchIntegrity({
      board: input.board,
      records,
      frozenTiles: input.frozenTiles,
      letterAtFreeze: letterAtFreeze(rounds, records),
    });
    if (failures.length > 0) {
      trackMatchIntegrityFailed({ matchId: input.matchId, roundNumber: input.roundNumber, failures });
    }
    return failures;
  } catch (error) {
    console.error("[integrityCheck] could not run the check:", error);
    return [];
  }
}

async function loadRoundBoards(
  supabase: AnyClient,
  input: RoundIntegrityInput,
): Promise<(RoundBoard & { id: string })[]> {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, round_number, board_snapshot_after")
    .eq("match_id", input.matchId)
    .lte("round_number", input.roundNumber);
  if (error) throw new Error(`Failed to load rounds: ${error.message}`);
  return ((data ?? []) as RoundRow[]).map((row) => ({
    id: row.id,
    roundNumber: row.round_number,
    boardAfter:
      row.round_number === input.roundNumber
        ? input.board
        : ((row.board_snapshot_after as string[][] | null) ?? null),
  }));
}

async function loadRecords(
  supabase: AnyClient,
  matchId: string,
  rounds: (RoundBoard & { id: string })[],
): Promise<IntegrityRecord[]> {
  const { data, error } = await supabase
    .from("word_score_entries")
    .select("id, round_id, word, tiles")
    .eq("match_id", matchId);
  if (error) throw new Error(`Failed to load records: ${error.message}`);
  const roundNumberOf = new Map(rounds.map((r) => [r.id, r.roundNumber]));
  return ((data ?? []) as RecordRow[])
    .filter((row) => roundNumberOf.has(row.round_id))
    .map((row) => ({
      id: row.id,
      word: row.word,
      roundNumber: roundNumberOf.get(row.round_id) as number,
      tiles: row.tiles ?? [],
    }));
}
