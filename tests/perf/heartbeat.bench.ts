import { afterAll, describe, expect, test } from "vitest";

import { connectTestDb } from "../integration/db/harness";

/**
 * Spec 070 T042, research R18: every open tab beats every 10s, so a beat must
 * stay cheap: one upsert on the tab, one on the summary row and the attention
 * read, well under 100ms at p95. 100 players, two tabs each, two beats a tab.
 * Live local Supabase; skips without one.
 */
const BEAT_SLA_MS = 100;
const PLAYERS = 100;
const db = await connectTestDb();

describe.skipIf(!db)("heartbeat performance (spec 070)", () => {
  const ids: string[] = [];
  afterAll(async () => {
    await db!.client.from("presence_tabs").delete().in("player_id", ids);
    await db!.client.from("players").delete().in("id", ids);
  });

  test(`a beat takes under ${BEAT_SLA_MS}ms at p95`, async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data } = await db!.client
      .from("players")
      .insert(Array.from({ length: PLAYERS }, (_, i) => ({ username: `t070hb-${i}-${suffix}`, display_name: `H${i}`, status: "available", lobby_language: "is" })))
      .select("id");
    ids.push(...(data ?? []).map((r) => r.id as string));
    const durations: number[] = [];
    for (const id of ids) {
      for (const tab of [crypto.randomUUID(), crypto.randomUUID()]) {
        for (let beat = 0; beat < 2; beat += 1) {
          const started = performance.now();
          const { error } = await db!.client.rpc("beat_tab", { p_player: id, p_tab: tab, p_visible: beat === 0, p_input_ago_ms: 1_000, p_page: "lobby" });
          durations.push(performance.now() - started);
          expect(error).toBeNull();
        }
      }
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    console.log(JSON.stringify({ event: "perf.heartbeat", samples: durations.length, p95: Math.round(p95 * 10) / 10 }));
    expect(p95).toBeLessThan(BEAT_SLA_MS);
  }, 120_000);
});
