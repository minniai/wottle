/**
 * Spec 069 (T005, SC-001): seats, leaves and the deadline sweep, fired at one
 * table at once, never start a match without both seats, never both start and
 * void it, and set the start at most once. Live local Supabase; skips without one.
 */
import { afterAll, describe, expect, it } from "vitest";

import { blankBoard, connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
const ROUNDS = 100;

function shuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

describe.skipIf(!db)("the table under contention (spec 069 SC-001)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  it(`holds its invariants across ${ROUNDS} rounds of seats, leaves and sweeps racing`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [a, b] = await f.players_([`A${round}`, `B${round}`]);
      const created = await f.rpc("create_match_between", { p_a: a, p_b: b, p_language: "is", p_origin: "queue", p_ref: null, p_pressed_by: [] });
      const match = created.match_id as string;
      // Half the rounds race at a table whose time has run out.
      if (round % 2 === 1) {
        await db!.client.from("matches").update({ table_deadline_at: new Date(Date.now() - 1_000).toISOString() }).eq("id", match);
      }
      const seat = (p: string) => () => f.rpc("seat_player", { p_match: match, p_player: p, p_board: blankBoard(), p_lead_ms: 4_500, p_clock_ms: 300_000 });
      const leave = (p: string) => () => f.rpc("void_table", { p_match: match, p_reason: "left", p_by: p });
      const sweep = () => f.rpc("void_table", { p_match: match, p_reason: "not_seated", p_by: null });
      const attempts = shuffle([seat(a), seat(b), seat(a), seat(b), ...(round % 3 === 0 ? [leave(a)] : []), ...(round % 5 === 0 ? [leave(b)] : []), sweep]);
      const results = await Promise.all(attempts.map((run) => run()));

      const { data: m } = await db!.client.from("matches").select("state, ended_reason, started_at, board, player_a_seated_at, player_b_seated_at").eq("id", match).single();
      const started = results.filter((r) => r.status === "started");
      const voided = results.filter((r) => r.status === "void" && r.reason);
      if (m!.state === "in_progress") {
        expect(m!.player_a_seated_at, `round ${round}`).not.toBeNull();
        expect(m!.player_b_seated_at, `round ${round}`).not.toBeNull();
        expect(m!.board, `round ${round}`).not.toBeNull();
        expect(voided, `round ${round}`).toHaveLength(0);
        // Every started answer names the same start.
        expect(new Set(started.map((r) => r.startedAt)).size, `round ${round}`).toBe(1);
      } else {
        expect(m, `round ${round}`).toMatchObject({ state: "completed", ended_reason: "void" });
        expect(voided, `round ${round}`).toHaveLength(1);
      }
      // The expired half can never start.
      if (round % 2 === 1) expect(m!.state, `round ${round}`).toBe("completed");
    }
  }, 120_000);
});
