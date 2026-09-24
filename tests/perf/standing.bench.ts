import { afterAll, describe, expect, test } from "vitest";

import { connectTestDb } from "../integration/db/harness";

/**
 * Spec 070 T083, research R6: every page reads the viewer's standing on each
 * poke and on a 3s or 12s poll, so the read must stay under 150ms at p95. A
 * lobby of 50 players with tabs, the viewer with a call in and a challenge
 * out. Live local Supabase; skips without one.
 */
const STANDING_SLA_MS = 150;
const PLAYERS = 50;
const READS = 100;
const db = await connectTestDb();

describe.skipIf(!db)("standing read performance (spec 070)", () => {
  const ids: string[] = [];
  afterAll(async () => {
    await db!.client.from("match_invitations").delete().or(`sender_id.in.(${ids.join(",")}),recipient_id.in.(${ids.join(",")})`);
    await db!.client.from("presence_tabs").delete().in("player_id", ids);
    await db!.client.from("players").delete().in("id", ids);
  });

  test(`the standing read takes under ${STANDING_SLA_MS}ms at p95`, async () => {
    // Read after the harness has loaded .env.local, which the service client needs.
    const { readStanding } = await import("@/lib/standing/readStanding");
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data } = await db!.client
      .from("players")
      .insert(Array.from({ length: PLAYERS }, (_, i) => ({ username: `t070st-${i}-${suffix}`, display_name: `S${i}`, status: "available", lobby_language: "is" })))
      .select("id");
    ids.push(...(data ?? []).map((r) => r.id as string));
    for (const id of ids) await db!.client.rpc("beat_tab", { p_player: id, p_tab: crypto.randomUUID(), p_visible: true, p_input_ago_ms: 1_000, p_page: "lobby" });
    const [viewer, caller, callee] = ids;
    expect((await db!.client.rpc("send_challenge", { p_sender: caller, p_recipient: viewer })).error).toBeNull();
    expect((await db!.client.rpc("send_challenge", { p_sender: viewer, p_recipient: callee })).error).toBeNull();

    const durations: number[] = [];
    for (let i = 0; i < READS; i += 1) {
      const started = performance.now();
      const facts = await readStanding(viewer);
      durations.push(performance.now() - started);
      expect(facts.incoming).toHaveLength(1);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    console.log(JSON.stringify({ event: "perf.standing", samples: durations.length, p95: Math.round(p95 * 10) / 10 }));
    expect(p95).toBeLessThan(STANDING_SLA_MS);
  });
});
