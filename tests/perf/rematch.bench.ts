import { afterAll, describe, expect, test } from "vitest";

import { connectTestDb } from "../integration/db/harness";
import { Fixtures } from "../integration/db/matchCreation.fixtures";

/**
 * Spec 071 T084 (plan: performance goals): asking for a rematch and accepting it stay inside the
 * move path's budget (constitution II: under 200ms at p95). Live local Supabase; skips without one.
 */
const SLA_MS = 200;
const MATCHES = 20;
const db = await connectTestDb();

describe.skipIf(!db)("rematch performance (spec 071)", () => {
  const f = new Fixtures(db!);
  afterAll(() => f.dropAll());

  test(`request_rematch and accept_rematch each take under ${SLA_MS}ms at p95`, async () => {
    const requests: number[] = [];
    const accepts: number[] = [];
    for (let i = 0; i < MATCHES; i += 1) {
      const [a, b] = await f.players_([`RmA${i}`, `RmB${i}`]);
      const match = await f.completed(a, b);
      await f.onMatch(a, match);
      await f.onMatch(b, match);
      let started = performance.now();
      const sent = await f.rpc("request_rematch", { p_match: match, p_actor: a });
      requests.push(performance.now() - started);
      expect(sent.status).toBe("sent");
      started = performance.now();
      const accepted = await f.rpc("accept_rematch", { p_request: sent.request_id, p_actor: b });
      accepts.push(performance.now() - started);
      expect(accepted.status).toBe("created");
    }
    const p95 = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length * 0.95) - 1];
    console.log(JSON.stringify({ event: "perf.rematch", requestP95Ms: Math.round(p95(requests)), acceptP95Ms: Math.round(p95(accepts)) }));
    expect(p95(requests)).toBeLessThan(SLA_MS);
    expect(p95(accepts)).toBeLessThan(SLA_MS);
  });
});
