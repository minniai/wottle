/**
 * Spec 072 (T051, SC-002): two browsers pressing accept ▸ on one link at the
 * same moment get one match, every time; the other reads the link as expired.
 */
import { afterAll, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { acceptLink, makeLink } from "./linkFixtures";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
const ROUNDS = 100;

describe.skipIf(!db)("two accepts on one link (spec 072 SC-002)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  it(`creates exactly one match in each of ${ROUNDS} rounds`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const [sender, a, b] = await f.players_([`S${round}`, `A${round}`, `B${round}`]);
      const { hash, result } = await makeLink(f, sender);
      const [ra, rb] = await Promise.all([acceptLink(f, hash, a), acceptLink(f, hash, b)]);
      expect([ra.status, rb.status].sort()).toEqual(["created", "expired"]);
      const { count } = await db!.client.from("matches").select("id", { count: "exact", head: true }).eq("origin_ref", result.link_id as string);
      expect(count).toBe(1);
    }
  }, 180_000);

  it("gives one match to one player's double press", async () => {
    for (let round = 0; round < 20; round++) {
      const [sender, a] = await f.players_([`DS${round}`, `DA${round}`]);
      const { hash } = await makeLink(f, sender);
      const [r1, r2] = await Promise.all([acceptLink(f, hash, a), acceptLink(f, hash, a)]);
      expect([r1.status, r2.status].sort()).toEqual(["created", "expired"]);
    }
  }, 60_000);
});
