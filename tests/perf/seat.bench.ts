import { afterAll, describe, expect, test } from "vitest";

import { seatPlayer } from "@/lib/match/tableService";

import { connectTestDb } from "../integration/db/harness";
import { Fixtures } from "../integration/db/matchCreation.fixtures";

/**
 * Spec 069 T068: sitting down is one locked RPC plus the starting board; it
 * must keep the move path's budget (constitution II: RTT < 200ms p95). Both
 * seats of 20 tables are timed, the second of each one also starting the match.
 * Live local Supabase; skips without one.
 */
const SEAT_SLA_MS = 200;
const TABLES = 20;
const db = await connectTestDb();

describe.skipIf(!db)("seating performance (spec 069)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  test(`a seat takes under ${SEAT_SLA_MS}ms at p95`, async () => {
    const durations: number[] = [];
    for (let i = 0; i < TABLES; i += 1) {
      const [a, b] = await f.players_([`SeatA${i}`, `SeatB${i}`]);
      const created = await f.rpc("create_match_between", { p_a: a, p_b: b, p_language: "is", p_origin: "queue", p_ref: null, p_pressed_by: [] });
      for (const player of [a, b]) {
        const started = performance.now();
        const outcome = await seatPlayer({ client: db!.client }, created.match_id as string, player);
        durations.push(performance.now() - started);
        expect(["seated", "started"]).toContain(outcome.status);
      }
    }
    durations.sort((x, y) => x - y);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    console.log(JSON.stringify({ event: "perf.seat", p95Ms: Math.round(p95 * 100) / 100, seats: durations.length }));
    expect(p95).toBeLessThan(SEAT_SLA_MS);
  });
});
