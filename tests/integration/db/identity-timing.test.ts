/**
 * Spec 067 SC-007: entering, renewing and creating a match each add under 50ms
 * at p95. Measured as the database round trip from this process, 200 calls each,
 * against local Supabase; skips without one.
 */
import { afterAll, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
const CALLS = 200;
const BUDGET_MS = 50;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

async function timed(call: () => PromiseLike<unknown>): Promise<number> {
  const start = performance.now();
  await call();
  return performance.now() - start;
}

describe.skipIf(!db)("identity and match creation latency (spec 067 SC-007)", () => {
  const f = new Fixtures(db!);
  const hash = "b".repeat(64);
  const username = `t067-timing-${crypto.randomUUID().slice(0, 6)}`;
  afterAll(async () => {
    await db!.client.from("players").delete().eq("username", username);
    await f.dropAll();
  });

  it(`enter_player and resolve_claim stay under ${BUDGET_MS}ms p95`, async () => {
    const enter: number[] = [];
    const resolve: number[] = [];
    for (let i = 0; i < CALLS; i += 1) {
      enter.push(await timed(() => db!.client.rpc("enter_player", { p_username: username, p_display_name: "Timing", p_claim_hash: hash })));
      resolve.push(await timed(() => db!.client.rpc("resolve_claim", { p_claim_hash: hash })));
    }
    expect(p95(enter)).toBeLessThan(BUDGET_MS);
    expect(p95(resolve)).toBeLessThan(BUDGET_MS);
  }, 60_000);

  it(`create_match_between stays under ${BUDGET_MS}ms p95`, async () => {
    const samples: number[] = [];
    for (let i = 0; i < CALLS; i += 1) {
      const [a, b] = await f.players_([`TA${i}`, `TB${i}`]);
      samples.push(await timed(() => db!.client.rpc("create_match_between", { p_a: a, p_b: b, p_language: "is", p_origin: "challenge", p_ref: null })));
    }
    expect(p95(samples)).toBeLessThan(BUDGET_MS);
  }, 120_000);
});
