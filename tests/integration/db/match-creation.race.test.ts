/**
 * Spec 067 (T024, SC-004): every way into a match, fired at the same players at
 * once, never books anyone into two live matches and never deadlocks.
 * Live local Supabase; skips without one.
 */
import { afterAll, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
const ROUNDS = 100;

function shuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

describe.skipIf(!db)("match creation under contention (spec 067 SC-004)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  it(`should never double-book across ${ROUNDS} rounds of every path racing`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [a, d] = await f.players_([`A${round}`, `D${round}`], "matchmaking", "is");
      const [b, c] = await f.players_([`B${round}`, `C${round}`]);
      const old = await f.match(a, b, "completed");
      const [aToB, aToC, cToA, request] = await Promise.all([
        f.invite(a, b),
        f.invite(a, c),
        f.invite(c, a),
        f.rematchRequest(old, a, b),
      ]);

      const attempts = shuffle([
        () => f.rpc("accept_invite", { p_invite: aToB, p_actor: b, p_ttl_seconds: 30 }),
        () => f.rpc("accept_invite", { p_invite: aToC, p_actor: c, p_ttl_seconds: 30 }),
        () => f.rpc("accept_invite", { p_invite: cToA, p_actor: a, p_ttl_seconds: 30, p_origin: "crossed_challenge" }),
        () => f.rpc("pair_from_queue", { p_self: a, p_opponent: d, p_language: "is" }),
        () => f.rpc("pair_from_queue", { p_self: d, p_opponent: a, p_language: "is" }),
        () => f.rpc("accept_rematch", { p_request: request, p_actor: b }),
      ]);
      const results = await Promise.all(attempts.map((attempt) => attempt()));

      const created = results.filter((r) => r.status === "created");
      expect(created.length, `round ${round}: someone gets a match`).toBeGreaterThanOrEqual(1);
      for (const player of [a, b, c, d]) {
        expect(await f.liveMatchesOf(player), `round ${round}`).toBeLessThanOrEqual(1);
      }
    }
  }, 120_000);
});
