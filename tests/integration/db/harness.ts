/**
 * A live local Supabase for the spec 050 database tests (T026). These tests
 * exercise `receive_move`, `claim_next_move`, `finish_move` and
 * `find_due_matches` for real; there is no mocked client here.
 *
 * They skip themselves when no database answers: CI's unit + integration job
 * runs without Supabase, `pnpm quickstart` + `pnpm test:integration` runs them.
 * `.env.local` is read here because Vitest does not load it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(__dirname, "../../../.env.local");

function loadEnvLocal(): void {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

export interface TestDb {
  client: SupabaseClient;
}

/** The service-role client when a database answers within two seconds; null otherwise. */
export async function connectTestDb(): Promise<TestDb | null> {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const probe = client.from("match_moves").select("id").limit(1);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000));
    const { error } = await Promise.race([probe, timeout]);
    return error ? null : { client };
  } catch {
    return null;
  }
}

export const BOARD_LETTER = "x";

/** A 10×10 field of one letter no dictionary spells: every swap resolves with no word. */
export function blankBoard(): string[][] {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => BOARD_LETTER));
}

export interface TestMatch {
  matchId: string;
  playerAId: string;
  playerBId: string;
}

export interface MatchOptions {
  board?: string[][];
  state?: "pending" | "in_progress";
  /** Milliseconds from now; negative is a clock already run out. */
  deadlineInMs?: number;
  moves?: { a: number; b: number };
  moveLimit?: number;
  /** Spec 060: the match's game language; Icelandic unless given. */
  language?: "is" | "en";
}

/** Two fresh players and one match between them, in progress with the clock running unless told otherwise. */
export async function createTestMatch(db: TestDb, options: MatchOptions = {}): Promise<TestMatch> {
  const suffix = randomUUID().slice(0, 8);
  const { data: players, error: playerError } = await db.client
    .from("players")
    .insert([
      { username: `t050-a-${suffix}`, display_name: "Anna", elo_rating: 1200, games_played: 0 },
      { username: `t050-b-${suffix}`, display_name: "Kári", elo_rating: 1200, games_played: 0 },
    ])
    .select("id, username");
  if (playerError || !players || players.length !== 2) throw new Error(`players.insert: ${playerError?.message}`);
  const [a, b] = players.sort((p, q) => p.username.localeCompare(q.username));
  const now = Date.now();
  const matchId = randomUUID();
  const { error: matchError } = await db.client.from("matches").insert({
    id: matchId,
    board_seed: matchId,
    player_a_id: a.id,
    player_b_id: b.id,
    state: options.state ?? "in_progress",
    board: options.board ?? blankBoard(),
    frozen_tiles: {},
    move_limit: options.moveLimit ?? 10,
    language: options.language ?? "is",
    started_at: new Date(now - 1000).toISOString(),
    deadline_at: new Date(now + (options.deadlineInMs ?? 300_000)).toISOString(),
    player_a_moves: options.moves?.a ?? 0,
    player_b_moves: options.moves?.b ?? 0,
    // Spec 069: a match that started was sat at by both players.
    player_a_seated_at: new Date(now - 5000).toISOString(),
    player_b_seated_at: new Date(now - 5000).toISOString(),
  });
  if (matchError) throw new Error(`matches.insert: ${matchError.message}`);
  return { matchId, playerAId: a.id, playerBId: b.id };
}

export async function dropTestMatch(db: TestDb, match: TestMatch): Promise<void> {
  await db.client.from("match_ratings").delete().eq("match_id", match.matchId);
  await db.client.from("matches").delete().eq("id", match.matchId);
  await db.client.from("players").delete().in("id", [match.playerAId, match.playerBId]);
}

export interface Receipt {
  status: "accepted" | "rejected";
  reason?: string;
  moveId?: string;
  globalSeq?: number;
  receivedAt?: string;
}

export interface Swap {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** The two letters as the player saw them; the blank board's letter unless given. */
  from?: string;
  to?: string;
}

/** One `receive_move` call. The default swap is enough for the receipt gates. */
export async function receive(db: TestDb, match: TestMatch, playerId: string, swap: Swap = { x: 0, y: 0, tx: 1, ty: 0 }): Promise<Receipt> {
  const { data, error } = await db.client.rpc("receive_move", {
    p_match_id: match.matchId,
    p_player_id: playerId,
    p_from_x: swap.x,
    p_from_y: swap.y,
    p_to_x: swap.tx,
    p_to_y: swap.ty,
    p_from_letter: swap.from ?? BOARD_LETTER,
    p_to_letter: swap.to ?? BOARD_LETTER,
  });
  if (error) throw new Error(`receive_move: ${error.message}`);
  return data as Receipt;
}

export interface Claimed {
  move: { id: string; global_seq: number; player_id: string; claim_count: number; status: string };
  match: { resolved_seq: number; board: string[][]; frozen_tiles: Record<string, unknown> | null; language?: string };
}

export async function claim(db: TestDb, matchId: string, staleMs = 10_000): Promise<Claimed | null> {
  const { data, error } = await db.client.rpc("claim_next_move", { p_match_id: matchId, p_stale_ms: staleMs });
  if (error) throw new Error(`claim_next_move: ${error.message}`);
  return (data as Claimed | null) ?? null;
}

/** Finish a claim as a refusal: nothing changes on the match but the cursor. */
export async function finishRejected(db: TestDb, claimed: Claimed): Promise<{ written: number }> {
  const { data, error } = await db.client.rpc("finish_move", {
    p_move_id: claimed.move.id,
    p_expected_resolved_seq: claimed.move.global_seq - 1,
    p_payload: {
      status: "rejected",
      rejectionReason: "moved",
      delta: 0,
      boardBefore: claimed.match.board,
      boardAfter: claimed.match.board,
      frozenBefore: claimed.match.frozen_tiles ?? {},
      frozenAfter: claimed.match.frozen_tiles ?? {},
      words: [],
    },
  });
  if (error) throw new Error(`finish_move: ${error.message}`);
  return data as { written: number };
}

/** Drain the queue by refusing every claimable move. */
export async function drainRejecting(db: TestDb, matchId: string): Promise<number> {
  let n = 0;
  for (;;) {
    const c = await claim(db, matchId);
    if (!c) return n;
    await finishRejected(db, c);
    n += 1;
  }
}

/**
 * Pending rows written straight into `match_moves`, bypassing `receive_move`'s
 * clock gates. The one-in-flight index still holds, so at most two: A's then B's.
 */
export async function insertPendingMoves(db: TestDb, match: TestMatch, count: 1 | 2): Promise<string[]> {
  const rows = Array.from({ length: count }, (_, i) => ({
    match_id: match.matchId,
    player_id: i % 2 === 0 ? match.playerAId : match.playerBId,
    global_seq: i + 1,
    from_x: i,
    from_y: 5,
    to_x: i,
    to_y: 6,
    from_letter: BOARD_LETTER,
    to_letter: BOARD_LETTER,
    status: "pending",
  }));
  const { data, error } = await db.client.from("match_moves").insert(rows).select("id");
  if (error || !data) throw new Error(`match_moves.insert: ${error?.message}`);
  await db.client.from("matches").update({ move_seq: count }).eq("id", match.matchId);
  return data.map((r) => r.id as string);
}

export async function readMatch(db: TestDb, matchId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.client.from("matches").select("*").eq("id", matchId).single();
  if (error || !data) throw new Error(`matches.select: ${error?.message}`);
  return data as Record<string, unknown>;
}

export async function readMoves(db: TestDb, matchId: string): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await db.client.from("match_moves").select("*").eq("match_id", matchId).order("global_seq");
  if (error || !data) throw new Error(`match_moves.select: ${error?.message}`);
  return data as Array<Record<string, unknown>>;
}
