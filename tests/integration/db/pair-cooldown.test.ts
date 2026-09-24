/**
 * Spec 071 (T026, clarification Q1): a declined or unanswered rematch starts the pair's 60s
 * cooldown, shared with challenges; it never counts toward the three-declines rule.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("the pair cooldown after a rematch (spec 071)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  async function endedRequest(a: string, b: string, status: "declined" | "expired" | "withdrawn"): Promise<void> {
    const match = await f.completed(a, b);
    const id = await f.rematchRequest(match, a, b);
    await db!.client.from("rematch_requests").update({ status, responded_at: new Date().toISOString() }).eq("id", id);
  }

  async function lobbyReady(ids: string[]): Promise<void> {
    for (const id of ids) {
      await db!.client.from("presence_tabs").insert({ tab_id: crypto.randomUUID(), player_id: id, language: "is", page: "lobby", visible: true, cadence_ms: 10_000 });
    }
  }

  it.each(["declined", "expired"] as const)("holds the requester's challenges to that player for 60s after a %s rematch", async (status) => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    await lobbyReady([birna, kari]);
    await endedRequest(birna, kari, status);
    const sent = await f.rpc("send_challenge", { p_sender: birna, p_recipient: kari });
    expect(sent.status).toBe("declined_recently");
    expect(Date.parse(sent.until as string) - Date.now()).toBeGreaterThan(55_000);
    expect((await f.rpc("send_challenge", { p_sender: kari, p_recipient: birna })).status).toBe("sent");
  });

  it("starts no cooldown for a withdrawn request", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    await lobbyReady([birna, kari]);
    await endedRequest(birna, kari, "withdrawn");
    expect((await f.rpc("send_challenge", { p_sender: birna, p_recipient: kari })).status).toBe("sent");
  });

  it("never silences a sender for declined rematches", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    for (let i = 0; i < 3; i++) await endedRequest(birna, kari, "declined");
    const { data } = await db!.client.rpc("challenger_silenced", { p_sender: birna, p_recipient: kari });
    expect(data).toBeFalsy();
  });
});
