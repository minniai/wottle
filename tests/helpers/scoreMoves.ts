import { loadDictionary } from "@/lib/game-engine/dictionary";
import { resolveOne } from "@/lib/match/moveResolver";
import type { BoardGrid } from "@/lib/types/board";
import type { FrozenTileMap, WordScoreBreakdown } from "@/lib/types/match";

/** One swap as the scoring regression tests describe it; `submittedAt` stands for receipt order. */
export interface ScoredMoveInput {
  playerId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  submittedAt: string;
}

export interface ScoreMovesInput {
  boardBefore: BoardGrid;
  acceptedMoves: ScoredMoveInput[];
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
  /** Accepted and ignored: older tests pass match and round ids. */
  [extra: string]: unknown;
}

export interface ScoreMovesResult {
  playerAWords: WordScoreBreakdown[];
  playerBWords: WordScoreBreakdown[];
  deltas: { playerA: number; playerB: number };
  newFrozenTiles: FrozenTileMap;
  wasPartialFreeze: boolean;
  durationMs: number;
  finalBoard: BoardGrid;
}

/**
 * Resolves moves one at a time, in receipt order, through the resolver's own
 * pure step (`resolveOne`, spec 050): each move is scored against the board
 * and freeze map the previous one left, and a move onto a letter an earlier
 * move froze is refused. The letters a player saw are the board's own, so no
 * move is refused as `moved` here. Keeps the scoring regression suite (rules
 * doc §10) running against the code that actually resolves moves.
 */
export async function scoreMovesInReceiptOrder(input: ScoreMovesInput): Promise<ScoreMovesResult> {
  const started = performance.now();
  const dictionary = await loadDictionary("is");
  const ordered = [...input.acceptedMoves].sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
  let board = input.boardBefore;
  let frozen = input.frozenTiles;
  let wasPartialFreeze = false;
  const words: WordScoreBreakdown[] = [];
  ordered.forEach((m, i) => {
    const outcome = resolveOne({
      move: {
        id: `move-${i + 1}`,
        playerId: m.playerId,
        globalSeq: i + 1,
        from: { x: m.fromX, y: m.fromY },
        to: { x: m.toX, y: m.toY },
        fromLetter: board[m.fromY][m.fromX],
        toLetter: board[m.toY][m.toX],
        receivedAt: m.submittedAt,
      },
      board,
      frozenTiles: frozen,
      playerAId: input.playerAId,
      playerBId: input.playerBId,
      dictionary,
    });
    words.push(...outcome.words);
    board = outcome.boardAfter;
    frozen = outcome.frozenAfter;
    wasPartialFreeze ||= outcome.wasPartialFreeze;
  });
  const of = (id: string) => words.filter((w) => w.playerId === id);
  const total = (ws: WordScoreBreakdown[]) => ws.reduce((sum, w) => sum + w.totalPoints, 0);
  return {
    playerAWords: of(input.playerAId),
    playerBWords: of(input.playerBId),
    deltas: { playerA: total(of(input.playerAId)), playerB: total(of(input.playerBId)) },
    newFrozenTiles: frozen,
    wasPartialFreeze,
    durationMs: performance.now() - started,
    finalBoard: board,
  };
}
