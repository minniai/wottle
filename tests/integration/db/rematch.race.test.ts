/**
 * Spec 071 (T027, SC-003): two players pressing rematch ▸ at the same moment get one match,
 * every time, and neither sees an error.
 */
import { afterAll, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
const ROUNDS = 100;

describe.skipIf(!db)("crossed rematch requests (spec 071 SC-003)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  it(`creates exactly one match in each of ${ROUNDS} rounds`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const [a, b] = await f.players_([`A${round}`, `B${round}`]);
      const match = await f.completed(a, b);
      await f.onMatch(a, match);
      await f.onMatch(b, match);
      const [ra, rb] = await Promise.all([
        f.rpc("request_rematch", { p_match: match, p_actor: a }),
        f.rpc("request_rematch", { p_match: match, p_actor: b }),
      ]);
      const statuses = [ra.status, rb.status].sort();
      expect(statuses).toEqual(["accepted", "sent"]);
      const { count } = await db!.client.from("matches").select("id", { count: "exact", head: true }).eq("rematch_of", match);
      expect(count).toBe(1);
    }
  }, 120_000);
});
