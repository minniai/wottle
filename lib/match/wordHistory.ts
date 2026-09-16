import { mapWordScoreRow, type WordScoreEntryRow } from "@/lib/match/wordScoreRow";
import type { getServiceRoleClient } from "@/lib/supabase/server";
import type { WordScore } from "@/lib/types/match";

type Supabase = ReturnType<typeof getServiceRoleClient>;

/** One scored word of a completed round, as the ledger and the field draw it. */
export interface HistoryWord extends WordScore {
  roundNumber: number;
  isDuplicate: boolean;
}

export interface MatchWordHistory {
  matchId: string;
  words: HistoryWord[];
}

type RoundRef = { id: string; round_number: number };
type HistoryRow = WordScoreEntryRow & { round_id: string; is_duplicate: boolean | null };

/**
 * Every scored word of every completed round below `beforeRound`, in round
 * order (spec 047 FR-003). Served once per mount, rematch or missed broadcast
 * by `GET /api/match/[matchId]/words` — never on the move path, where
 * `loadMatchState` runs on every broadcast and poll.
 *
 * Only completed rounds: the live round's first-mover rows reach the client as
 * `partialSummary` and are replaced by the canonical summary when it lands.
 */
export async function loadMatchWordHistory(
  client: Supabase,
  matchId: string,
  beforeRound: number,
): Promise<HistoryWord[]> {
  const rounds = await loadCompletedRounds(client, matchId, beforeRound);
  if (rounds.length === 0) return [];
  const rows = await loadEntries(client, matchId, rounds.map((r) => r.id));
  const roundNumberOf = new Map(rounds.map((r) => [r.id, r.round_number]));
  return rows
    .map((row) => toHistoryWord(row, roundNumberOf.get(row.round_id) ?? 0))
    .sort((a, b) => a.roundNumber - b.roundNumber || a.playerId.localeCompare(b.playerId));
}

async function loadCompletedRounds(client: Supabase, matchId: string, beforeRound: number): Promise<RoundRef[]> {
  const { data, error } = await client
    .from("rounds")
    .select("id, round_number")
    .eq("match_id", matchId)
    .eq("state", "completed")
    .lt("round_number", beforeRound);
  if (error) throw new Error(`Failed to load rounds: ${error.message}`);
  return (data ?? []) as RoundRef[];
}

async function loadEntries(client: Supabase, matchId: string, roundIds: string[]): Promise<HistoryRow[]> {
  const { data, error } = await client
    .from("word_score_entries")
    .select("round_id, player_id, word, length, letters_points, bonus_points, total_points, tiles, is_duplicate")
    .eq("match_id", matchId)
    .in("round_id", roundIds);
  if (error) throw new Error(`Failed to load word history: ${error.message}`);
  return (data ?? []) as HistoryRow[];
}

function toHistoryWord(row: HistoryRow, roundNumber: number): HistoryWord {
  return { ...mapWordScoreRow(row), roundNumber, isDuplicate: row.is_duplicate ?? false };
}
