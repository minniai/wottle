"use server";

import { loadDictionary } from "@/lib/game-engine/dictionary";
import { applySwap } from "@/lib/game-engine/board";
import { priceSwap, type PricedWord } from "@/lib/match/previewScoring";
import { previewSwapInputSchema } from "@/lib/match/previewSchemas";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { logPlaytestInfo } from "@/lib/observability/log";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { boardGridSchema, type BoardGrid, type Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot } from "@/lib/types/match";

export interface PreviewSwapResult {
  status: "ok" | "rejected" | "rate_limited" | "unauthenticated" | "forbidden" | "error";
  words?: PricedWord[];
  total?: number;
  error?: string;
}

/**
 * Read-only pricing of a candidate swap (spec 044, contracts/preview-swap.md).
 * Same pipeline as scoring minus freeze/persist/broadcast. Both variants
 * require a session (Clarifications Q5); the match variant additionally
 * requires the caller to be a participant. Writes nothing.
 */
export async function previewSwap(rawInput: unknown): Promise<PreviewSwapResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated", error: "Sign in to price a swap" };
  }

  const parsed = previewSwapInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "rejected", error: parsed.error.issues[0]?.message ?? "Invalid preview input" };
  }
  const input = parsed.data;

  assertWithinRateLimit({
    identifier: session.player.id,
    scope: "match:preview-swap",
    limit: 60,
    windowMs: 60_000,
    errorMessage: "Too many previews. Please slow down before trying again.",
  });

  const started = performance.now();
  const context =
    input.kind === "match"
      ? await loadMatchPreviewContext(input.matchId, session.player.id)
      : { board: input.board as BoardGrid, frozenTiles: {} as FrozenTileMap, playerSlot: "player_a" as PlayerSlot };
  if ("status" in context) {
    return context;
  }

  const fromKey = `${input.from.x},${input.from.y}`;
  const toKey = `${input.to.x},${input.to.y}`;
  if (fromKey in context.frozenTiles || toKey in context.frozenTiles) {
    return { status: "rejected", error: "A frozen letter cannot be swapped" };
  }

  const dictionary = await loadDictionary("is");
  const price = priceSwap({
    board: context.board,
    from: input.from,
    to: input.to,
    frozenTiles: context.frozenTiles,
    playerSlot: context.playerSlot,
    dictionary,
  });

  logPlaytestInfo("preview-swap.priced", {
    matchId: input.kind === "match" ? input.matchId : undefined,
    playerId: session.player.id,
    metadata: { kind: input.kind, durationMs: Math.round(performance.now() - started), wordCount: price.words.length },
  });

  return { status: "ok", words: price.words, total: price.total };
}

interface PreviewContext {
  board: BoardGrid;
  frozenTiles: FrozenTileMap;
  playerSlot: PlayerSlot;
}

/**
 * Authoritative board for the preview: the round's starting snapshot with the
 * opponent's already-submitted swap applied (their move lands before ours at
 * resolution when they submitted first), plus the current frozen map — which
 * already includes any instant first-mover freezes.
 */
async function loadMatchPreviewContext(
  matchId: string,
  playerId: string,
): Promise<PreviewContext | PreviewSwapResult> {
  const supabase = getServiceRoleClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("current_round, state, player_a_id, player_b_id, frozen_tiles")
    .eq("id", matchId)
    .single();
  if (matchError || !match) return { status: "error", error: "Match not found" };
  if (playerId !== match.player_a_id && playerId !== match.player_b_id) {
    return { status: "forbidden", error: "You are not a player in this match" };
  }
  if (match.state !== "in_progress") return { status: "rejected", error: "Match has ended" };

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, board_snapshot_before")
    .eq("match_id", matchId)
    .eq("round_number", match.current_round)
    .single();
  if (roundError || !round) return { status: "error", error: "Round not found" };

  let board: BoardGrid;
  try {
    board = boardGridSchema.parse(round.board_snapshot_before);
  } catch {
    return { status: "error", error: "Invalid board state" };
  }

  const { data: submissions } = await supabase
    .from("move_submissions")
    .select("player_id, from_x, from_y, to_x, to_y, status")
    .eq("round_id", round.id);
  board = applyOpponentSwaps(board, submissions ?? [], playerId);

  return {
    board,
    frozenTiles: (match.frozen_tiles ?? {}) as FrozenTileMap,
    playerSlot: playerId === match.player_a_id ? "player_a" : "player_b",
  };
}

interface SubmissionRow {
  player_id: string;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  status: string;
}

function applyOpponentSwaps(board: BoardGrid, rows: SubmissionRow[], playerId: string): BoardGrid {
  return rows
    .filter((row) => row.player_id !== playerId && row.status !== "timeout")
    .reduce((grid, row) => {
      const from: Coordinate = { x: row.from_x, y: row.from_y };
      const to: Coordinate = { x: row.to_x, y: row.to_y };
      try {
        return applySwap(grid, { from, to });
      } catch {
        return grid;
      }
    }, board);
}
