import { afterAll, describe, expect, test } from "vitest";

import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import { loadCompletedMoves } from "@/lib/review/movesRepository";

import { blankBoard, connectTestDb } from "../integration/db/harness";
import { Fixtures } from "../integration/db/matchCreation.fixtures";

/**
 * Spec 071 T083 (plan: performance goals): review's one read of a 20-move match under 150ms at
 * p95, and building its steps under 5ms. Live local Supabase; skips without one.
 */
const READ_SLA_MS = 150;
const BUILD_SLA_MS = 5;
const RUNS = 30;
const db = await connectTestDb();

describe.skipIf(!db)("review performance (spec 071)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  test(`a 20-move match reads under ${READ_SLA_MS}ms and builds under ${BUILD_SLA_MS}ms at p95`, async () => {
    const [a, b] = await f.players_(["PerfA", "PerfB"]);
    const matchId = await f.completed(a, b);
    await db!.client.from("matches").update({ started_at: new Date(Date.now() - 300_000).toISOString(), deadline_at: new Date().toISOString(), board: blankBoard() }).eq("id", matchId);
    const board = blankBoard();
    const rows = Array.from({ length: 20 }, (_, i) => ({
      match_id: matchId,
      player_id: i % 2 === 0 ? a : b,
      global_seq: i + 1,
      seq: Math.floor(i / 2) + 1,
      from_x: i % 10, from_y: 0, to_x: i % 10, to_y: 1,
      from_letter: "x", to_letter: "x",
      status: "resolved",
      board_before: board, board_after: board, frozen_before: {}, frozen_after: {},
      delta: 0, score_a_after: 0, score_b_after: 0,
    }));
    const { error } = await db!.client.from("match_moves").insert(rows);
    expect(error).toBeNull();

    const reads: number[] = [];
    const builds: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const started = performance.now();
      const moves = await loadCompletedMoves(db!.client as never, matchId);
      reads.push(performance.now() - started);
      const built = performance.now();
      expect(buildReviewSteps(moves!)).toHaveLength(20);
      builds.push(performance.now() - built);
    }
    const p95 = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length * 0.95) - 1];
    console.log(JSON.stringify({ event: "perf.review_moves", readP95Ms: Math.round(p95(reads)), buildP95Ms: Math.round(p95(builds) * 100) / 100 }));
    expect(p95(reads)).toBeLessThan(READ_SLA_MS);
    expect(p95(builds)).toBeLessThan(BUILD_SLA_MS);
  });
});
