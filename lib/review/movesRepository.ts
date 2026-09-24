import { mapWordScoreRows, type WordScoreEntryRow } from "@/lib/match/wordScoreRow";
import type { getServiceRoleClient } from "@/lib/supabase/server";
import type { BoardGrid } from "@/lib/types/board";
import type { FrozenTileMap, MatchEndedReason } from "@/lib/types/match";
import type { MovesResponse, ReviewMoveRow } from "@/lib/types/review";

type Supabase = ReturnType<typeof getServiceRoleClient>;

export interface MatchRow {
  id: string;
  state: string;
  ended_reason: string | null;
  language: string;
  board: BoardGrid | null;
  player_a_id: string;
  player_b_id: string;
  started_at: string | null;
  deadline_at: string | null;
  move_limit: number;
  completed_at: string | null;
  winner_id: string | null;
  player_a_score: number;
  player_b_score: number;
}

export interface MoveRow {
  id: string;
  player_id: string;
  global_seq: number;
  seq: number | null;
  status: string;
  rejection_reason: "frozen" | "moved" | null;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  received_at: string;
  board_before: BoardGrid | null;
  board_after: BoardGrid | null;
  frozen_after: FrozenTileMap | null;
  score_a_after: number | null;
  score_b_after: number | null;
  delta: number | null;
  word_score_entries: WordScoreEntryRow[] | null;
}

const MATCH_COLUMNS =
  "id, state, ended_reason, language, board, player_a_id, player_b_id, started_at, deadline_at, move_limit, completed_at, winner_id, player_a_score, player_b_score";
const MOVE_COLUMNS =
  "id, player_id, global_seq, seq, status, rejection_reason, from_x, from_y, to_x, to_y, received_at, board_before, board_after, frozen_after, score_a_after, score_b_after, delta, word_score_entries(player_id, word, length, letters_points, bonus_points, total_points, tiles)";

/**
 * Spec 071 (FR-043, research R1): every finished move of a completed match, for review. Reads
 * with the service role because `match_moves` RLS admits only participants, and review is
 * public once a match is over. Null for anything that is not a completed, non-void match.
 */
export async function loadCompletedMoves(client: Supabase, matchId: string): Promise<MovesResponse | null> {
  const { data: match } = await client.from("matches").select(MATCH_COLUMNS).eq("id", matchId).maybeSingle();
  if (!isReviewable(match as MatchRow | null)) return null;
  const row = match as MatchRow;
  const [moves, names] = await Promise.all([loadMoves(client, matchId), loadNames(client, [row.player_a_id, row.player_b_id])]);
  return toMovesResponse(row, moves, names);
}

async function loadMoves(client: Supabase, matchId: string): Promise<MoveRow[]> {
  const { data, error } = await client
    .from("match_moves")
    .select(MOVE_COLUMNS)
    .eq("match_id", matchId)
    .in("status", ["resolved", "rejected"])
    .order("global_seq", { ascending: true });
  if (error) throw new Error(`Failed to load moves: ${error.message}`);
  return (data ?? []) as unknown as MoveRow[];
}

async function loadNames(client: Supabase, ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await client.from("players").select("id, username, display_name").in("id", ids);
  if (error) throw new Error(`Failed to load players: ${error.message}`);
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_name || p.username) as string]));
}

function isReviewable(match: MatchRow | null): match is MatchRow {
  return !!match && match.state === "completed" && match.ended_reason !== "void";
}

/** Pure: the rows as review reads them, or null when the match is not reviewable. */
export function toMovesResponse(match: MatchRow, moves: MoveRow[], names: Map<string, string>): MovesResponse | null {
  if (!isReviewable(match)) return null;
  const finished = moves.filter((m) => m.status === "resolved" || m.status === "rejected").sort((p, q) => p.global_seq - q.global_seq);
  const startedAt = match.started_at ?? match.completed_at ?? new Date(0).toISOString();
  return {
    matchId: match.id,
    language: match.language === "en" ? "en" : "is",
    players: { a: playerOf(match.player_a_id, names), b: playerOf(match.player_b_id, names) },
    startedAt,
    durationMs: match.deadline_at ? Date.parse(match.deadline_at) - Date.parse(startedAt) : 0,
    moveLimit: match.move_limit,
    endedReason: (match.ended_reason ?? "moves_complete") as MatchEndedReason,
    completedAt: match.completed_at ?? startedAt,
    winnerId: match.winner_id,
    finalScores: { a: match.player_a_score, b: match.player_b_score },
    initialBoard: finished[0]?.board_before ?? match.board ?? [],
    moves: finished.map((m) => toReviewRow(m, match.player_a_id)),
  };
}

function playerOf(id: string, names: Map<string, string>): { id: string; displayName: string } {
  return { id, displayName: names.get(id) ?? "" };
}

function toReviewRow(m: MoveRow, playerAId: string): ReviewMoveRow {
  return {
    globalSeq: m.global_seq,
    slot: m.player_id === playerAId ? "player_a" : "player_b",
    seq: m.seq,
    status: m.status === "rejected" ? "rejected" : "resolved",
    rejectionReason: m.rejection_reason,
    swap: { from: { x: m.from_x, y: m.from_y }, to: { x: m.to_x, y: m.to_y } },
    receivedAt: m.received_at,
    boardAfter: m.board_after ?? m.board_before ?? [],
    frozenAfter: m.frozen_after ?? {},
    scoreAfter: { a: m.score_a_after ?? 0, b: m.score_b_after ?? 0 },
    delta: m.delta ?? 0,
    words: mapWordScoreRows(m.word_score_entries),
  };
}
