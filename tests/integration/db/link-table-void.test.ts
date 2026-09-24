/**
 * Spec 072 T006 (clarification Q1): the friend who accepted may leave a link
 * table the sender has not sat at. It voids as not_seated against the sender,
 * and the leave never counts toward the friend's table-leave cooldown.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { acceptLink, makeLink } from "./linkFixtures";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

async function matchRow(id: string): Promise<Record<string, unknown>> {
  const { data } = await db!.client.from("matches").select("*").eq("id", id).single();
  return data as Record<string, unknown>;
}

describe.skipIf(!db)("leaving a link table (spec 072 Q1)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  async function linkTable(): Promise<{ birna: string; kari: string; match: string }> {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash } = await makeLink(f, birna);
    const accepted = await acceptLink(f, hash, kari);
    return { birna, kari, match: accepted.match_id as string };
  }

  it("voids as not_seated against the absent sender", async () => {
    const { birna, kari, match } = await linkTable();
    const result = await f.rpc("void_table", { p_match: match, p_reason: "left", p_by: kari });
    expect(result).toMatchObject({ status: "void", reason: "not_seated", voidedBy: birna });
    expect(await matchRow(match)).toMatchObject({ ended_reason: "void", void_reason: "not_seated", voided_by: birna });
    const { data } = await db!.client.from("players").select("id, status, table_missed_at").in("id", [birna, kari]);
    const byId = new Map((data ?? []).map((p) => [p.id, p]));
    expect(byId.get(birna)?.table_missed_at).toBeTruthy();
    expect(byId.get(kari)).toMatchObject({ status: "available", table_missed_at: null });
  });

  it("never puts the friend in the table-leave cooldown", async () => {
    let kariId = "";
    for (let i = 0; i < 2; i += 1) {
      const [birna] = await f.players_([`Birna${i}`]);
      if (!kariId) [kariId] = await f.players_(["Kari"]);
      const { hash } = await makeLink(f, birna);
      const accepted = await acceptLink(f, hash, kariId);
      await f.rpc("void_table", { p_match: accepted.match_id, p_reason: "left", p_by: kariId });
    }
    const { data } = await db!.client.rpc("table_leave_cooldown_until", { p_player: kariId });
    expect(data).toBeNull();
  });

  it("keeps a leave by the sender as left", async () => {
    const { birna, match } = await linkTable();
    const row = await matchRow(match);
    const now = new Date().toISOString();
    const birnaIsA = row.player_a_id === birna;
    await db!.client.from("matches").update({ player_a_seated_at: birnaIsA ? now : null, player_b_seated_at: birnaIsA ? null : now }).eq("id", match);
    const result = await f.rpc("void_table", { p_match: match, p_reason: "left", p_by: birna });
    expect(result).toMatchObject({ reason: "left", voidedBy: birna });
  });

  it("keeps a leave from a table that is not a link table as left", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const created = await f.rpc("create_match_between", { p_a: birna, p_b: kari, p_language: "is", p_origin: "challenge", p_ref: null, p_pressed_by: [kari] });
    const result = await f.rpc("void_table", { p_match: created.match_id, p_reason: "left", p_by: kari });
    expect(result).toMatchObject({ reason: "left", voidedBy: kari });
  });
});
