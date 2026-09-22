import { beforeAll, describe, expect, test } from "vitest";

import { loadDictionary } from "@/lib/game-engine/dictionary";
import { resolveOne } from "@/lib/match/moveResolver";
import type { BoardGrid } from "@/lib/types/board";

const PLAYER_A = "player-a-bench";
const PLAYER_B = "player-b-bench";
/** Constitution II: word validation < 50ms server-side; one move is one validation. */
const RESOLVE_SLA_MS = 50;
const RUNS = 20;

/** `restuh` at row 0: swapping (0,0) with (5,0) spells `hestur`. */
function makeBoard(): BoardGrid {
  const board: BoardGrid = Array.from({ length: 10 }, () => Array(10).fill("x")) as BoardGrid;
  ["r", "e", "s", "t", "u", "h"].forEach((ch, i) => (board[0][i] = ch));
  return board;
}

describe("move resolution performance (spec 050, warm dictionary)", () => {
  let dictionary: Set<string>;
  beforeAll(async () => {
    dictionary = await loadDictionary("is");
  });

  test(`resolveOne completes in under ${RESOLVE_SLA_MS}ms at p95`, () => {
    const durations: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const started = performance.now();
      const outcome = resolveOne({
        move: { id: `m${i}`, playerId: PLAYER_A, globalSeq: 1, from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, fromLetter: "r", toLetter: "h", receivedAt: "2026-09-21T00:00:00Z" },
        board: makeBoard(),
        frozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        dictionary,
        moverTotal: 0,
      });
      durations.push(performance.now() - started);
      expect(outcome.status).toBe("resolved");
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    console.log(JSON.stringify({ event: "perf.move-resolve", p95Ms: Math.round(p95 * 100) / 100, runs: RUNS }));
    expect(p95).toBeLessThan(RESOLVE_SLA_MS);
  });
});
