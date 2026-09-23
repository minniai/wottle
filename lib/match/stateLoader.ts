import { TABLE_COLUMNS, tableOf, type TableRow } from "@/lib/match/table";
import { readRatings } from "@/lib/rating/playerRatings";
import { getLanguagePack } from "@/lib/game-engine/languagePack";
import type { Language } from "@/lib/types/game-config";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateBoard } from "@/lib/game-engine/boardGenerator";
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
  WordScore,
} from "@/lib/types/match";

import { getDisconnectRecord, RECONNECT_WINDOW_MS } from "./disconnectStore";
import { findStaleParticipantDetail } from "./heartbeatRepository";
import { mapWordScoreRows, type WordScoreEntryRow } from "./wordScoreRow";

type AnyClient = SupabaseClient<any, any, any>;

/**
 * The room's snapshot (spec 050, contracts/match-state.md). One read of the
 * match row, the in-flight and last finished moves, and the heartbeats.
 *
 * Start: while the match is `pending`, a participant's load calls
 * `start_match_if_ready`, which records the caller, sets the board once and
 * starts the clock 3s ahead once both have loaded (or 10s after creation).
 * Self-heal: a pending or stale move dispatches the resolver; a passed
 * deadline dispatches settlement. Both are deduplicated per process.
 */
export const MATCH_CLOCK_MS = Number(process.env.PLAYTEST_MATCH_CLOCK_MS ?? 300_000);
export const START_COUNTDOWN_MS = 3_000;
export const START_GRACE_MS = 10_000;
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

// ─── Start ───────────────────────────────────────────────────────────

interface StartAnswer {
  found: boolean;
  started?: boolean;
  state?: MatchPhase;
  startedAt?: string | null;
  deadlineAt?: string | null;
}

function languageOf(match: Pick<MatchRow, "language">): Language {
  return match.language ?? "is";
}

/** The starting board from the seed, drawn from the match language's letters (spec 060 FR-014). */
function boardFor(match: Pick<MatchRow, "board_seed" | "id" | "language">): string[][] {
  return generateBoard({ seed: match.board_seed ?? match.id, weights: getLanguagePack(languageOf(match)).letterWeights });
}

async function startIfReady(client: AnyClient, match: MatchRow, callerId: string): Promise<void> {
  const board = parseBoard(match.board) ?? boardFor(match);
  const { data, error } = await client.rpc("start_match_if_ready", {
    p_match_id: match.id,
    p_caller_id: callerId,
    p_board: board,
    p_clock_ms: MATCH_CLOCK_MS,
    p_countdown_ms: START_COUNTDOWN_MS,
    p_grace_ms: START_GRACE_MS,
  });
  if (error) {
    console.error("[MatchState] start_match_if_ready failed:", error.message);
    return;
  }
  const answer = (data ?? {}) as StartAnswer;
  match.board = board;
  if (answer.state) match.state = answer.state;
  match.started_at = answer.startedAt ?? match.started_at;
  match.deadline_at = answer.deadlineAt ?? match.deadline_at;
  if (answer.started) {
    const language = languageOf(match);
    void import("@/lib/game-engine/dictionary").then(({ loadDictionary }) => loadDictionary(language)).catch(() => undefined);
  }
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
  const inMemory =
    getDisconnectRecord(match.id, match.player_a_id) ?? getDisconnectRecord(match.id, match.player_b_id) ?? null;
  const stale =
    !inMemory && match.state === "in_progress"
      ? await findStaleParticipantDetail(client, {
          matchId: match.id,
          playerAId: match.player_a_id,
          playerBId: match.player_b_id,
          matchCreatedAt: new Date(match.created_at),
        })
      : null;
  const disconnectedPlayerId = inMemory?.playerId ?? stale?.playerId ?? null;
  return {
    disconnectedPlayerId,
    disconnectedAt: inMemory?.disconnectedAt ?? stale?.disconnectedAt ?? null,
    reconnectWindowMs: disconnectedPlayerId ? RECONNECT_WINDOW_MS : undefined,
  };
}

// ─── The loader ──────────────────────────────────────────────────────

export interface LoadMatchStateOptions {
  /** The participant loading the room; lets a pending match record them and start. */
  callerId?: string;
}

export async function loadMatchState(
  client: AnyClient,
  matchId: string,
  options: LoadMatchStateOptions = {},
): Promise<MatchState | null> {
  const { data, error: matchError } = await client.from("matches").select(MATCH_COLUMNS).eq("id", matchId).maybeSingle();
  if (matchError) {
    console.error("[MatchState] Failed to load match:", matchError);
    return null;
  }
  const match = (data ?? null) as MatchRow | null;
  if (!match) return null;

  if (match.state === "pending" && options.callerId) {
    await startIfReady(client, match, options.callerId);
  }

  const facts = await loadMoveFacts(client, matchId);
  if (match.state === "in_progress" && facts.stale) triggerResolveInBackground(matchId);
  if (isSettlementDue(match, Date.now())) {
    triggerSettleInBackground(matchId);
  }

  const board = parseBoard(match.board);
  if (!board) {
    logPlaytestError("match.board.unreadable", { matchId, metadata: { matchState: match.state } });
  }

  const clock: MatchClock = { startedAt: match.started_at, deadlineAt: match.deadline_at, serverNow: new Date().toISOString() };

  return {
    matchId: match.id,
    board: board ?? boardFor(match),
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
    stakes: null,
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
