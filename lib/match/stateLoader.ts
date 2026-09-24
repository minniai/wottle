import { TABLE_COLUMNS, tableOf, type TableRow } from "@/lib/match/table";
import { DEFAULT_RATING_RECORD, readRatings } from "@/lib/rating/playerRatings";
import { stakesFor } from "@/lib/rating/stakes";
import type { Language } from "@/lib/types/game-config";
import type { SupabaseClient } from "@supabase/supabase-js";

import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import { logPlaytestError } from "@/lib/observability/log";
import { boardGridSchema } from "@/lib/types/board";
import type { Coordinate } from "@/lib/types/board";
import type {
  FrozenTileMap,
  MatchClock,
  MatchEndedReason,
  MatchPhase,
  MatchPlayerProfile,
  MatchPlayerProfiles,
  MatchState,
  MoveResolution,
  PlayerMatchFacts,
  Stakes,
  WordScore,
  SeriesView,
} from "@/lib/types/match";

import { getDisconnectRecord, RECONNECT_WINDOW_MS } from "./disconnectStore";
import { startingBoardFor } from "./startingBoard";
import { startTableIfSeated, voidDueTable } from "./tableService";
import { readParticipants } from "./heartbeatRepository";
import { mapWordScoreRows, type WordScoreEntryRow } from "./wordScoreRow";
import { rematchSeries } from "./rematchService";
import { seriesViewOf } from "@/lib/room/series";

type AnyClient = SupabaseClient<any, any, any>;

/**
 * The room's snapshot (spec 050, contracts/match-state.md). One read of the
 * match row, the in-flight and last finished moves, and the heartbeats.
 *
 * The table (spec 069): a `pending` match is a table. The loader never
 * starts one by itself and never hands out its letters; it voids a table
 * whose time to sit down has run out and starts one both players sat at
 * (both through `tableService`), and reads the players' stakes.
 * Self-heal: a pending or stale move dispatches the resolver; a passed
 * deadline dispatches settlement. Both are deduplicated per process.
 */
/** A move claimed longer ago than this is reclaimable; the loader nudges the resolver when it sees one. */
export const STALE_CLAIM_MS = 10_000;

const pendingSelfHeals = new Set<string>();

function dispatchOnce(key: string, work: () => Promise<unknown>, label: string): void {
  if (pendingSelfHeals.has(key)) return;
  pendingSelfHeals.add(key);
  void work()
    .catch((error) => console.error(`[stateLoader] ${label} failed:`, error))
    .finally(() => pendingSelfHeals.delete(key));
}

function triggerResolveInBackground(matchId: string): void {
  dispatchOnce(`resolve:${matchId}`, async () => {
    const { resolvePendingMoves } = await import("./moveResolver");
    await resolvePendingMoves(matchId);
  }, "self-heal resolvePendingMoves");
}

type SettlementFacts = Pick<MatchRow, "state" | "deadline_at" | "player_a_moves" | "player_b_moves" | "move_limit">;

/** Worth dispatching settlement: both have the move limit, or the deadline has passed (contracts/settlement.md). */
export function isSettlementDue(match: SettlementFacts, nowMs: number): boolean {
  if (match.state !== "in_progress") return false;
  const bothDone = match.player_a_moves >= match.move_limit && match.player_b_moves >= match.move_limit;
  const pastDeadline = match.deadline_at !== null && nowMs > new Date(match.deadline_at).getTime();
  return bothDone || pastDeadline;
}

function triggerSettleInBackground(matchId: string): void {
  dispatchOnce(`settle:${matchId}`, async () => {
    const { settleMatchIfDue } = await import("./matchSettlement");
    await settleMatchIfDue(matchId);
  }, "self-heal settleMatchIfDue");
}

/** @internal — test hook to reset the dedup set between runs. */
export function __resetSelfHealTrackerForTests(): void {
  pendingSelfHeals.clear();
}

// ─── Rows ────────────────────────────────────────────────────────────

interface MatchRow extends TableRow {
  id: string;
  state: MatchPhase;
  board_seed: string | null;
  board: unknown;
  player_a_id: string;
  player_b_id: string;
  frozen_tiles: unknown;
  winner_id: string | null;
  ended_reason: string | null;
  completed_at: string | null;
  created_at: string;
  started_at: string | null;
  deadline_at: string | null;
  resolved_seq: number;
  player_a_moves: number;
  player_b_moves: number;
  player_a_score: number;
  player_b_score: number;
  move_limit: number;
  language: Language | null;
}

interface MoveRow {
  id: string;
  player_id: string;
  global_seq: number;
  seq: number | null;
  status: "pending" | "resolving" | "resolved" | "rejected";
  rejection_reason: "frozen" | "moved" | null;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  received_at: string;
  claimed_at: string | null;
  resolved_at: string | null;
  board_after: unknown;
  frozen_after: unknown;
  delta: number | null;
  score_a_after: number | null;
  score_b_after: number | null;
}

const MATCH_COLUMNS =
  "id,state,board_seed,board,player_a_id,player_b_id,frozen_tiles,winner_id,ended_reason,completed_at,created_at,started_at,deadline_at,resolved_seq,player_a_moves,player_b_moves,player_a_score,player_b_score,move_limit,language," + TABLE_COLUMNS;

const MOVE_COLUMNS =
  "id,player_id,global_seq,seq,status,rejection_reason,from_x,from_y,to_x,to_y,received_at,claimed_at,resolved_at,board_after,frozen_after,delta,score_a_after,score_b_after";

function parseBoard(value: unknown): string[][] | null {
  const parsed = boardGridSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function coerceFrozenTileMap(value: unknown): FrozenTileMap {
  return value && typeof value === "object" ? (value as FrozenTileMap) : {};
}

// ─── The table (spec 069) ───────────────────────────────────────────

function languageOf(match: Pick<MatchRow, "language">): Language {
  return match.language ?? "is";
}

async function readMatchRow(client: AnyClient, matchId: string): Promise<MatchRow | null> {
  const { data, error } = await client.from("matches").select(MATCH_COLUMNS).eq("id", matchId).maybeSingle();
  if (error) {
    console.error("[MatchState] Failed to load match:", error);
    return null;
  }
  return (data ?? null) as MatchRow | null;
}

/** A table past its time without both seats is void; one both sat at starts. Either way, read it again. */
async function settleTable(client: AnyClient, match: MatchRow): Promise<MatchRow> {
  const seated = match.player_a_seated_at !== null && match.player_b_seated_at !== null;
  const due = match.table_deadline_at !== null && Date.parse(match.table_deadline_at) <= Date.now();
  if (!seated && !due) return match;
  if (seated) await startTableIfSeated({ client }, match.id);
  else await voidDueTable({ client }, match.id);
  return (await readMatchRow(client, match.id)) ?? match;
}

async function stakesOf(client: AnyClient, match: MatchRow): Promise<Record<string, Stakes>> {
  const ratings = await readRatings(client, [match.player_a_id, match.player_b_id], languageOf(match));
  const a = ratings.get(match.player_a_id) ?? DEFAULT_RATING_RECORD;
  const b = ratings.get(match.player_b_id) ?? DEFAULT_RATING_RECORD;
  return { [match.player_a_id]: stakesFor(a, b), [match.player_b_id]: stakesFor(b, a) };
}

/** The letters leave the server only once both players are seated (FR-003). */
function boardOf(match: MatchRow): string[][] | null {
  if (match.state === "pending" || match.ended_reason === "void") return null;
  const board = parseBoard(match.board);
  if (!board) logPlaytestError("match.board.unreadable", { matchId: match.id, metadata: { matchState: match.state } });
  return board ?? startingBoardFor(match);
}

// ─── Moves ───────────────────────────────────────────────────────────

interface MoveFacts {
  inFlight: Map<string, MoveRow>;
  lastFinished: Map<string, MoveRow>;
  words: Map<string, WordScore[]>;
  stale: boolean;
}

async function loadMoveFacts(client: AnyClient, matchId: string): Promise<MoveFacts> {
  const [{ data: open }, { data: finished }] = await Promise.all([
    client.from("match_moves").select(MOVE_COLUMNS).eq("match_id", matchId).in("status", ["pending", "resolving"]),
    client
      .from("match_moves")
      .select(MOVE_COLUMNS)
      .eq("match_id", matchId)
      .in("status", ["resolved", "rejected"])
      .order("global_seq", { ascending: false })
      .limit(6),
  ]);
  const inFlight = new Map<string, MoveRow>();
  let stale = false;
  for (const row of (open ?? []) as MoveRow[]) {
    inFlight.set(row.player_id, row);
    if (row.status === "pending") stale = true;
    if (row.status === "resolving" && row.claimed_at && Date.now() - new Date(row.claimed_at).getTime() > STALE_CLAIM_MS) stale = true;
  }
  const lastFinished = new Map<string, MoveRow>();
  for (const row of (finished ?? []) as MoveRow[]) {
    if (!lastFinished.has(row.player_id)) lastFinished.set(row.player_id, row);
  }
  const words = await loadWordsFor(client, matchId, [...lastFinished.values()].map((m) => m.id));
  return { inFlight, lastFinished, words, stale };
}

async function loadWordsFor(client: AnyClient, matchId: string, moveIds: string[]): Promise<Map<string, WordScore[]>> {
  const out = new Map<string, WordScore[]>();
  if (moveIds.length === 0) return out;
  const { data } = await client
    .from("word_score_entries")
    .select("move_id, player_id, word, length, letters_points, bonus_points, total_points, tiles")
    .eq("match_id", matchId)
    .in("move_id", moveIds);
  for (const row of (data ?? []) as (WordScoreEntryRow & { move_id: string })[]) {
    const list = out.get(row.move_id) ?? [];
    list.push(...mapWordScoreRows([row]));
    out.set(row.move_id, list);
  }
  return out;
}

function toResolution(match: MatchRow, row: MoveRow, words: WordScore[]): MoveResolution {
  return {
    matchId: match.id,
    moveId: row.id,
    playerId: row.player_id,
    globalSeq: row.global_seq,
    seq: row.seq,
    status: row.status === "resolved" ? "resolved" : "rejected",
    ...(row.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
    swap: { from: { x: row.from_x, y: row.from_y }, to: { x: row.to_x, y: row.to_y } },
    board: parseBoard(row.board_after) ?? parseBoard(match.board) ?? [],
    words: words.map((w) => ({ ...w, direction: w.direction ?? tryDeriveReadingDirection(w.coordinates as Coordinate[]) })),
    delta: row.delta ?? 0,
    totals: { playerA: row.score_a_after ?? match.player_a_score, playerB: row.score_b_after ?? match.player_b_score },
    frozenTiles: coerceFrozenTileMap(row.frozen_after ?? match.frozen_tiles),
    movesPlayed: { playerA: match.player_a_moves, playerB: match.player_b_moves },
    resolvedAt: row.resolved_at ?? row.received_at,
  };
}

function playerFacts(match: MatchRow, playerId: string, facts: MoveFacts): PlayerMatchFacts {
  const isA = playerId === match.player_a_id;
  const open = facts.inFlight.get(playerId);
  const last = facts.lastFinished.get(playerId);
  return {
    playerId,
    movesPlayed: isA ? match.player_a_moves : match.player_b_moves,
    score: isA ? match.player_a_score : match.player_b_score,
    inFlight: open ? { moveId: open.id, globalSeq: open.global_seq, receivedAt: open.received_at } : null,
    lastResolution: last ? toResolution(match, last, facts.words.get(last.id) ?? []) : null,
  };
}

// ─── Disconnect ──────────────────────────────────────────────────────

async function disconnectFacts(client: AnyClient, match: MatchRow) {
  const participants =
    match.state === "in_progress"
      ? await readParticipants(client, {
          matchId: match.id,
          playerAId: match.player_a_id,
          playerBId: match.player_b_id,
          matchCreatedAt: new Date(match.created_at),
        })
      : { stale: null, steppedOut: null };
  const steppedOut = participants.steppedOut;
  // A player who left the match page for the lobby closed its tab's beacon: they stepped out, not away (spec 070 US8).
  const recorded = getDisconnectRecord(match.id, match.player_a_id) ?? getDisconnectRecord(match.id, match.player_b_id) ?? null;
  const inMemory = recorded && recorded.playerId !== steppedOut ? recorded : null;
  const gone = inMemory ?? participants.stale;
  const disconnectedPlayerId = gone?.playerId ?? null;
  return {
    disconnectedPlayerId,
    disconnectedAt: gone?.disconnectedAt ?? null,
    reconnectWindowMs: disconnectedPlayerId ? RECONNECT_WINDOW_MS : undefined,
    steppedOutPlayerId: steppedOut,
  };
}

/** Spec 071 (FR-018): a rematch's place in its series; seat-neutral, so the broadcast may carry it. */
async function seriesOf(client: AnyClient, match: MatchRow, rematchOf: string | null): Promise<SeriesView | null> {
  if (!rematchOf) return null;
  const rows = await rematchSeries(client, match.id);
  return seriesViewOf(rows, { matchId: match.id, completed: match.state === "completed", winnerId: match.winner_id ?? null }, match.player_a_id);
}

// ─── The loader ──────────────────────────────────────────────────────

export async function loadMatchState(client: AnyClient, matchId: string): Promise<MatchState | null> {
  const read = await readMatchRow(client, matchId);
  if (!read) return null;
  const match = read.state === "pending" ? await settleTable(client, read) : read;

  const facts = await loadMoveFacts(client, matchId);
  if (match.state === "in_progress" && facts.stale) triggerResolveInBackground(matchId);
  if (isSettlementDue(match, Date.now())) {
    triggerSettleInBackground(matchId);
  }

  const clock: MatchClock = { startedAt: match.started_at, deadlineAt: match.deadline_at, serverNow: new Date().toISOString() };

  return {
    matchId: match.id,
    board: boardOf(match),
    state: match.state,
    players: {
      playerA: playerFacts(match, match.player_a_id, facts),
      playerB: playerFacts(match, match.player_b_id, facts),
    },
    clock,
    moveLimit: match.move_limit ?? 10,
    language: languageOf(match),
    resolvedSeq: match.resolved_seq ?? 0,
    scores: { playerA: match.player_a_score ?? 0, playerB: match.player_b_score ?? 0 },
    frozenTiles: coerceFrozenTileMap(match.frozen_tiles),
    ...(await disconnectFacts(client, match)),
    winnerId: match.winner_id ?? null,
    endedReason: (match.ended_reason as MatchEndedReason | null) ?? null,
    completedAt: match.completed_at ?? null,
    table: tableOf(match),
    stakes: match.state === "pending" ? await stakesOf(client, match) : null,
    series: await seriesOf(client, match, tableOf(match).rematchOf),
  };
}

// ─── Profiles ────────────────────────────────────────────────────────

function mapPlayerRow(
  row: { id: string; username: string; display_name: string; avatar_url: string | null; elo_rating: number | null; games_played?: number | null },
): MatchPlayerProfile {
  return {
    playerId: row.id,
    displayName: row.display_name || row.username,
    username: row.username,
    avatarUrl: row.avatar_url,
    eloRating: row.elo_rating ?? 1200,
    gamesPlayed: typeof row.games_played === "number" ? row.games_played : undefined,
  };
}

function fallbackProfile(playerId: string, label: string): MatchPlayerProfile {
  return {
    playerId,
    displayName: label,
    username: label,
    avatarUrl: null,
    eloRating: 1200,
  };
}

/** Both players as the match shows them: names, and ratings in the match's language (spec 060 US4). */
export async function loadMatchPlayerProfiles(
  client: AnyClient,
  playerAId: string,
  playerBId: string,
  language: Language = "is",
): Promise<MatchPlayerProfiles> {
  const { data, error } = await client
    .from("players")
    .select("id, username, display_name, avatar_url, elo_rating, games_played")
    .in("id", [playerAId, playerBId]);

  if (error || !data) {
    console.warn("[MatchState] Failed to load player profiles:", error?.message);
    return {
      playerA: fallbackProfile(playerAId, "Player A"),
      playerB: fallbackProfile(playerBId, "Player B"),
    };
  }

  const ratings = await readRatings(client, [playerAId, playerBId], language).catch(() => null);
  const withRating = (row: any) => {
    const record = ratings?.get(row.id);
    return record ? { ...row, elo_rating: record.eloRating, games_played: record.gamesPlayed } : row;
  };
  const byId = new Map(data.map((row: any) => [row.id, withRating(row)]));
  const rowA = byId.get(playerAId);
  const rowB = byId.get(playerBId);

  return {
    playerA: rowA ? mapPlayerRow(rowA) : fallbackProfile(playerAId, "Player A"),
    playerB: rowB ? mapPlayerRow(rowB) : fallbackProfile(playerBId, "Player B"),
  };
}
