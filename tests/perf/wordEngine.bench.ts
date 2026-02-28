import { describe, test, expect, beforeAll } from "vitest";
import { loadDictionary } from "@/lib/game-engine/dictionary";
import { processRoundScoring } from "@/lib/game-engine/wordEngine";
import type { BoardGrid } from "@/lib/types/board";

const PLAYER_A = "player-a-bench";
const PLAYER_B = "player-b-bench";
const MATCH_ID = "bench-match";
const ROUND_ID = "bench-round";
const ENGINE_SLA_MS = 50;
const BENCHMARK_RUNS = 10;

/** Create a sparse board with 'hestur' at row 0, ready to be swapped. */
function makeTestBoard(): { before: BoardGrid; after: BoardGrid } {
  const before: BoardGrid = Array.from({ length: 10 }, () => Array(10).fill(" ")) as BoardGrid;
  // Set up 'restur' at row 0, with 'h' at position 5
  before[0][0] = "r"; before[0][1] = "e"; before[0][2] = "s";
  before[0][3] = "t"; before[0][4] = "u"; before[0][5] = "h";

  // Set up 'land' at row 3 (separate from row 0)
  before[3][0] = "d"; before[3][1] = "n"; before[3][2] = "a"; before[3][3] = "l";

  const after = before.map((row) => [...row]) as BoardGrid;
  // Player A swaps (0,0) ↔ (5,0): 'hestur' at row 0
  after[0][0] = "h"; after[0][5] = "r";
  // Player B swaps (0,3) ↔ (3,3): 'land' at row 3
  after[3][0] = "l"; after[3][3] = "d";

  return { before, after };
}

describe("word engine performance (FR-021 - <50ms SLA)", () => {
  let dict: Set<string>;

  beforeAll(async () => {
    dict = await loadDictionary();
  });

  test(`processRoundScoring completes in under ${ENGINE_SLA_MS}ms at p95`, async () => {
    const { before, after } = makeTestBoard();
    const durations: number[] = [];

    for (let i = 0; i < BENCHMARK_RUNS; i++) {
      const start = performance.now();
      await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: before,
        boardAfter: after,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
          { playerId: PLAYER_B, fromX: 0, fromY: 3, toX: 3, toY: 3 },
        ],
        frozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });
      durations.push(performance.now() - start);
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const p95 = sorted[p95Index];
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

    console.log(
      `Word engine benchmark (${BENCHMARK_RUNS} runs):`,
      `\n  avg: ${avg.toFixed(1)}ms`,
      `\n  min: ${sorted[0].toFixed(1)}ms`,
      `\n  max: ${sorted[sorted.length - 1].toFixed(1)}ms`,
      `\n  p95: ${p95.toFixed(1)}ms`,
    );

    expect(p95).toBeLessThan(ENGINE_SLA_MS);
  });
});
