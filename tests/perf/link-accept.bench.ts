import { afterAll, describe, expect, test } from "vitest";

import { connectTestDb } from "../integration/db/harness";
import { acceptLink, makeLink, readLink } from "../integration/db/linkFixtures";
import { Fixtures } from "../integration/db/matchCreation.fixtures";

/**
 * Spec 072 T057 (plan: performance goals): making, reading and accepting a
 * link stay inside the move path's budget (constitution II: under 200ms at
 * p95); reading is one index probe. Live local Supabase; skips without one.
 */
const SLA_MS = 200;
const READ_SLA_MS = 50;
const LINKS = 30;
const db = await connectTestDb();

describe.skipIf(!db)("invite link performance (spec 072)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  test(`create_link and accept_link under ${SLA_MS}ms, read_link under ${READ_SLA_MS}ms, at p95`, async () => {
    const creates: number[] = [];
    const reads: number[] = [];
    const accepts: number[] = [];
    const time = async <T>(into: number[], run: () => Promise<T>): Promise<T> => {
      const started = performance.now();
      const result = await run();
      into.push(performance.now() - started);
      return result;
    };
    for (let i = 0; i < LINKS; i += 1) {
      const [sender, friend] = await f.players_([`LkS${i}`, `LkF${i}`]);
      const made = await time(creates, () => makeLink(f, sender));
      expect(made.result.status).toBe("created");
      expect((await time(reads, () => readLink(f, made.hash))).valid).toBe(true);
      expect((await time(accepts, () => acceptLink(f, made.hash, friend))).status).toBe("created");
    }
    const p95 = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length * 0.95) - 1];
    console.log(JSON.stringify({ event: "perf.link", createP95Ms: Math.round(p95(creates)), readP95Ms: Math.round(p95(reads)), acceptP95Ms: Math.round(p95(accepts)) }));
    expect(p95(creates)).toBeLessThan(SLA_MS);
    expect(p95(reads)).toBeLessThan(READ_SLA_MS);
    expect(p95(accepts)).toBeLessThan(SLA_MS);
  });
});
