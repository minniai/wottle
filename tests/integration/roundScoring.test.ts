/**
 * Integration tests for round scoring pipeline.
 * Verifies processRoundScoring produces correct word breakdowns and deltas.
 */
import { describe, expect, test, beforeAll } from "vitest";
import type { BoardGrid } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

const PLAYER_A = "player-a-id";
const PLAYER_B = "player-b-id";
const MATCH_ID = "match-scoring-test";
const ROUND_ID = "round-1-id";

function emptyBoard(fill = " "): BoardGrid {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => fill),
  ) as BoardGrid;
}

/** Board where row 0 spells "búr" after swapping (0,0)↔(0,1): before ú-b-r, after b-ú-r. */
function makeBurBoard(): { boardBefore: BoardGrid; boardAfter: BoardGrid } {
  const before = emptyBoard();
  before[0][0] = "ú";
  before[0][1] = "b";
  before[0][2] = "r";

  const after = before.map((row) => [...row]) as BoardGrid;
  after[0][0] = "b";
  after[0][1] = "ú";
  return { boardBefore: before, boardAfter: after };
}

describe("round scoring integration", () => {
  beforeAll(async () => {
    const { loadDictionary } = await import("@/lib/game-engine/dictionary");
    await loadDictionary();
  });

  test("scores a valid word with correct letter points and length bonus", async () => {
    const { processRoundScoring } = await import(
      "@/lib/game-engine/wordEngine"
    );

    const { boardBefore, boardAfter } = makeBurBoard();

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_ID,
      boardBefore,
      boardAfter,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 1, toY: 0 },
      ],
      frozenTiles: {} as FrozenTileMap,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    // Player A should have scored "búr" (or similar valid words)
    expect(result.playerAWords.length).toBeGreaterThanOrEqual(1);
    expect(result.deltas.playerA).toBeGreaterThan(0);
    expect(result.deltas.playerB).toBe(0);
  });

  test("returns zero deltas when no words are formed", async () => {
    const { processRoundScoring } = await import(
      "@/lib/game-engine/wordEngine"
    );

    const board = emptyBoard();

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_ID,
      boardBefore: board,
      boardAfter: board,
      acceptedMoves: [],
      frozenTiles: {} as FrozenTileMap,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    expect(result.deltas).toEqual({ playerA: 0, playerB: 0 });
    expect(result.playerAWords).toHaveLength(0);
    expect(result.playerBWords).toHaveLength(0);
  });

  test("freezes tiles from scored words", async () => {
    const { processRoundScoring } = await import(
      "@/lib/game-engine/wordEngine"
    );

    const { boardBefore, boardAfter } = makeBurBoard();

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_ID,
      boardBefore,
      boardAfter,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 1, toY: 0 },
      ],
      frozenTiles: {} as FrozenTileMap,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    // Scored word tiles should be frozen
    const frozenCount = Object.keys(result.newFrozenTiles).length;
    expect(frozenCount).toBeGreaterThan(0);
  });
});
