import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";
import { applySwap } from "@/lib/game-engine/board";
import { scanFromSwapCoordinates } from "@/lib/game-engine/boardScanner";
import { selectOptimalCombination } from "@/lib/game-engine/crossValidator";
import { loadDictionary } from "@/lib/game-engine/dictionary";
import { freezeTiles } from "@/lib/game-engine/frozenTiles";
import { scoreBoardWords } from "@/lib/game-engine/wordEngine";
import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import { logPlaytestError, logPlaytestInfo } from "@/lib/observability/log";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { BoardGrid, Coordinate } from "@/lib/types/board";
import type {
  FrozenTileMap,
  MoveRejectionReason,
  MoveResolution,
  WordScore,
  WordScoreBreakdown,
} from "@/lib/types/match";

import { publishMoveResolved } from "./movePublisher";
import { publishMatchState } from "./statePublisher";

/**
 * The move resolver (spec 050, contracts/move-resolver.md).
 *
 * Moves resolve one at a time in receipt order: `claim_next_move` hands out the
 * move at `resolved_seq + 1` (pending, or resolving but stale), `resolveOne`
 * scores it, `finish_move` writes everything under a compare-and-set on
 * `resolved_seq`. A zombie that finishes after a reclaim writes zero rows.
 */
export const STALE_CLAIM_MS = 10_000;
/** After this many claims of one move without a finish, the match ends with `error`. */
export const MAX_CLAIMS = 3;

export interface ClaimedMove {
  id: string;
  playerId: string;
  globalSeq: number;
  from: Coordinate;
  to: Coordinate;
  fromLetter: string;
  toLetter: string;
  receivedAt: string;
}

export interface ResolveInput {
  move: ClaimedMove;
  board: BoardGrid;
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
  dictionary: Set<string>;
  letterValues?: Record<string, number>;
}

export interface ResolveOutcome {
  status: "resolved" | "rejected";
  rejectionReason?: MoveRejectionReason;
  boardBefore: BoardGrid;
  boardAfter: BoardGrid;
  frozenBefore: FrozenTileMap;
  frozenAfter: FrozenTileMap;
  words: WordScoreBreakdown[];
  delta: number;
  wasPartialFreeze: boolean;
}

const key = (c: Coordinate): string => `${c.x},${c.y}`;

function rejected(input: ResolveInput, reason: MoveRejectionReason): ResolveOutcome {
  return {
    status: "rejected",
    rejectionReason: reason,
    boardBefore: input.board,
    boardAfter: input.board,
    frozenBefore: input.frozenTiles,
    frozenAfter: input.frozenTiles,
    words: [],
    delta: 0,
    wasPartialFreeze: false,
  };
}

/** The refusal rules of rules §2: `frozen` first, then `moved`. */
function refusalFor(input: ResolveInput): MoveRejectionReason | null {
  const { move, board, frozenTiles } = input;
  if (key(move.from) in frozenTiles || key(move.to) in frozenTiles) return "frozen";
  if (board[move.from.y][move.from.x] !== move.fromLetter) return "moved";
  if (board[move.to.y][move.to.x] !== move.toLetter) return "moved";
  return null;
}

/**
 * Pure and deterministic: apply the swap, scan from its two coordinates,
 * cross-validate, score, freeze (rules §7.1). No duplicate suppression (§3.7).
 */
export function resolveOne(input: ResolveInput): ResolveOutcome {
  const refusal = refusalFor(input);
  if (refusal) return rejected(input, refusal);

  const { move, board, frozenTiles, playerAId, playerBId, dictionary } = input;
  const slot = move.playerId === playerAId ? "player_a" : "player_b";
  const boardAfter = applySwap(board, { from: move.from, to: move.to });
  const candidates = scanFromSwapCoordinates(boardAfter, [move.from, move.to], dictionary);
  const valid = selectOptimalCombination(candidates, boardAfter, frozenTiles, dictionary, slot);
  const words = scoreBoardWords(valid, move.playerId, frozenTiles, slot, input.letterValues ?? LETTER_SCORING_VALUES_IS);
  const freeze = freezeTiles({ scoredWords: words, existingFrozenTiles: frozenTiles, playerAId, playerBId });
  return {
    status: "resolved",
    boardBefore: board,
    boardAfter,
    frozenBefore: frozenTiles,
    frozenAfter: freeze.updatedFrozenTiles,
    words,
    delta: words.reduce((sum, w) => sum + w.totalPoints, 0),
    wasPartialFreeze: freeze.wasPartialFreeze,
  };
}

// ─── The claim / finish loop ─────────────────────────────────────────

interface ClaimRow {
  id: string;
  player_id: string;
  global_seq: number;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  from_letter: string;
  to_letter: string;
  received_at: string;
  claim_count: number;
}

interface ClaimMatch {
  board: BoardGrid;
  frozen_tiles: FrozenTileMap | null;
  player_a_id: string;
  player_b_id: string;
  player_a_score: number;
  player_b_score: number;
  player_a_moves: number;
  player_b_moves: number;
  move_limit: number;
  resolved_seq: number;
}

interface Claim {
  move: ClaimRow;
  match: ClaimMatch;
}

interface FinishResult {
  written: number;
  playerAMoves?: number;
  playerBMoves?: number;
  playerAScore?: number;
  playerBScore?: number;
  bothDone?: boolean;
}

type Client = ReturnType<typeof getServiceRoleClient>;

function toClaimedMove(row: ClaimRow): ClaimedMove {
  return {
    id: row.id,
    playerId: row.player_id,
    globalSeq: row.global_seq,
    from: { x: row.from_x, y: row.from_y },
    to: { x: row.to_x, y: row.to_y },
    fromLetter: row.from_letter,
    toLetter: row.to_letter,
    receivedAt: row.received_at,
  };
}

async function claimNext(client: Client, matchId: string): Promise<Claim | null> {
  const { data, error } = await client.rpc("claim_next_move", { p_match_id: matchId, p_stale_ms: STALE_CLAIM_MS });
  if (error) throw new Error(`claim_next_move: ${error.message}`);
  return (data as Claim | null) ?? null;
}

function toWordScore(w: WordScoreBreakdown): WordScore {
  return {
    playerId: w.playerId,
    word: w.word,
    length: w.length,
    lettersPoints: w.lettersPoints,
    bonusPoints: w.lengthBonus,
    totalPoints: w.totalPoints,
    coordinates: w.tiles,
    direction: tryDeriveReadingDirection(w.tiles),
  };
}

function finishPayload(outcome: ResolveOutcome): Record<string, unknown> {
  return {
    status: outcome.status,
    rejectionReason: outcome.rejectionReason ?? null,
    delta: outcome.delta,
    boardBefore: outcome.boardBefore,
    boardAfter: outcome.boardAfter,
    frozenBefore: outcome.frozenBefore,
    frozenAfter: outcome.frozenAfter,
    words: outcome.words.map((w) => ({
      word: w.word,
      length: w.length,
      lettersPoints: w.lettersPoints,
      bonusPoints: w.lengthBonus,
      totalPoints: w.totalPoints,
      tiles: w.tiles,
    })),
  };
}

async function finish(client: Client, claim: Claim, outcome: ResolveOutcome): Promise<FinishResult> {
  const { data, error } = await client.rpc("finish_move", {
    p_move_id: claim.move.id,
    p_expected_resolved_seq: claim.move.global_seq - 1,
    p_payload: finishPayload(outcome),
  });
  if (error) throw new Error(`finish_move: ${error.message}`);
  return (data as FinishResult | null) ?? { written: 0 };
}

function toResolution(matchId: string, claim: Claim, outcome: ResolveOutcome, fin: FinishResult): MoveResolution {
  const isA = claim.move.player_id === claim.match.player_a_id;
  const movesA = fin.playerAMoves ?? claim.match.player_a_moves;
  const movesB = fin.playerBMoves ?? claim.match.player_b_moves;
  return {
    matchId,
    moveId: claim.move.id,
    playerId: claim.move.player_id,
    globalSeq: claim.move.global_seq,
    seq: outcome.status === "resolved" ? (isA ? movesA : movesB) : null,
    status: outcome.status,
    ...(outcome.rejectionReason ? { rejectionReason: outcome.rejectionReason } : {}),
    swap: { from: { x: claim.move.from_x, y: claim.move.from_y }, to: { x: claim.move.to_x, y: claim.move.to_y } },
    board: outcome.boardAfter,
    words: outcome.words.map(toWordScore),
    delta: outcome.delta,
    totals: { playerA: fin.playerAScore ?? claim.match.player_a_score, playerB: fin.playerBScore ?? claim.match.player_b_score },
    frozenTiles: outcome.frozenAfter,
    movesPlayed: { playerA: movesA, playerB: movesB },
    resolvedAt: new Date().toISOString(),
  };
}

async function failMatch(matchId: string, claim: Claim, cause: unknown): Promise<void> {
  logPlaytestError("move.resolver.failed", {
    matchId,
    metadata: { moveId: claim.move.id, globalSeq: claim.move.global_seq, claims: claim.move.claim_count, cause: String(cause) },
  });
  if (claim.move.claim_count >= MAX_CLAIMS) {
    const { completeMatchInternal } = await import("@/app/actions/match/completeMatch");
    await completeMatchInternal(matchId, "error");
  }
}

async function resolveClaim(client: Client, matchId: string, claim: Claim): Promise<FinishResult> {
  const started = performance.now();
  const dictionary = await loadDictionary("is");
  const outcome = resolveOne({
    move: toClaimedMove(claim.move),
    board: claim.match.board,
    frozenTiles: claim.match.frozen_tiles ?? {},
    playerAId: claim.match.player_a_id,
    playerBId: claim.match.player_b_id,
    dictionary,
  });
  const fin = await finish(client, claim, outcome);
  if (fin.written === 0) return fin;
  logPlaytestInfo("move.resolved", {
    matchId,
    metadata: {
      moveId: claim.move.id,
      playerId: claim.move.player_id,
      globalSeq: claim.move.global_seq,
      status: outcome.status,
      rejectionReason: outcome.rejectionReason ?? null,
      words: outcome.words.length,
      delta: outcome.delta,
      durationMs: Math.round(performance.now() - started),
    },
  });
  await publishMoveResolved(toResolution(matchId, claim, outcome, fin));
  return fin;
}

/**
 * Drain every claimable move for a match in receipt order. Safe to call from
 * any number of instances at once; each claim is exclusive and each finish is
 * a compare-and-set. Returns true when the last finish brought both players to
 * the move limit (the caller settles the match).
 */
export async function resolvePendingMoves(matchId: string): Promise<{ resolved: number; bothDone: boolean }> {
  const client = getServiceRoleClient();
  let resolved = 0;
  let bothDone = false;
  for (;;) {
    const claim = await claimNext(client, matchId);
    if (!claim) break;
    if (claim.move.claim_count > 1) {
      logPlaytestInfo("move.reclaimed", { matchId, metadata: { moveId: claim.move.id, claims: claim.move.claim_count } });
    }
    let fin: FinishResult;
    try {
      fin = await resolveClaim(client, matchId, claim);
    } catch (cause) {
      await failMatch(matchId, claim, cause);
      break;
    }
    if (fin.written === 0) break;
    resolved += 1;
    bothDone = Boolean(fin.bothDone);
  }
  if (resolved > 0) {
    await publishMatchState(matchId).catch((e: unknown) => console.error("[MoveResolver] state broadcast failed:", e));
  }
  return { resolved, bothDone };
}
