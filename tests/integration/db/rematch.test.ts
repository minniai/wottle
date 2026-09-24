/**
 * Spec 071 (T025): the one decision of a rematch request, and how a request ends.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("request_rematch (spec 071)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const request = (match: string, actor: string) => f.rpc("request_rematch", { p_match: match, p_actor: actor });

  async function both(names = ["Birna", "Kari"], options: Parameters<Fixtures["completed"]>[2] = {}): Promise<[string, string, string]> {
    const [a, b] = await f.players_(names);
    const match = await f.completed(a, b, options);
    await f.onMatch(a, match);
    await f.onMatch(b, match);
    return [a, b, match];
  }

  it("sends one request lasting 30s when both are on the match within 2:00", async () => {
    const [birna, , match] = await both();
    const sent = await request(match, birna);
    expect(sent.status).toBe("sent");
    const ttl = Date.parse(sent.expires_at as string) - Date.now();
    expect(ttl).toBeGreaterThan(28_000);
    expect(ttl).toBeLessThanOrEqual(30_500);
    expect(await f.statusOf("rematch_requests", sent.request_id as string)).toBe("pending");
  });

  it("counts a hidden tab on the match as being there (Q2)", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const match = await f.completed(birna, kari);
    await f.onMatch(birna, match);
    await f.onMatch(kari, match, false);
    expect((await request(match, birna)).status).toBe("sent");
  });

  it.each([
    ["a live match", "in_progress"],
    ["a void table", "void"],
    ["an abandoned match", "abandoned"],
  ])("refuses %s", async (_name, kind) => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const match = kind === "in_progress" ? await f.match(birna, kari, "in_progress") : await f.completed(birna, kari, { endedReason: kind });
    expect(await request(match, birna)).toEqual({ status: "refused", reason: "not_completed" });
  });

  it("refuses anyone who did not play in it", async () => {
    const [, , match] = await both();
    const [embla] = await f.players_(["Embla"]);
    expect(await request(match, embla)).toEqual({ status: "refused", reason: "not_participant" });
  });

  it("refuses after the 2:00 window", async () => {
    const [birna, , match] = await both(["Birna", "Kari"], { agoMs: 121_000 });
    expect(await request(match, birna)).toEqual({ status: "refused", reason: "window_closed" });
  });

  it("refuses when either player has left the match", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const match = await f.completed(birna, kari);
    await f.onMatch(birna, match);
    expect(await request(match, birna)).toEqual({ status: "refused", reason: "opponent_left" });
    expect(await request(match, kari)).toEqual({ status: "refused", reason: "self_left" });
  });

  it("allows one request per match", async () => {
    const [birna, kari, match] = await both();
    const sent = await request(match, birna);
    expect(await request(match, birna)).toEqual({ status: "refused", reason: "already_requested" });
    await f.rpc("decline_rematch", { p_request: sent.request_id, p_actor: kari });
    expect(await request(match, kari)).toEqual({ status: "refused", reason: "already_requested" });
  });

  it("starts the match at once when the other presses too, both seated", async () => {
    const [birna, kari, match] = await both();
    await request(match, birna);
    const crossed = await request(match, kari);
    expect(crossed.status).toBe("accepted");
    const { data } = await db!.client.from("matches").select("rematch_of, origin, player_a_seated_at, player_b_seated_at").eq("id", crossed.new_match_id as string).single();
    expect(data).toMatchObject({ rematch_of: match, origin: "crossed_rematch" });
    expect(data!.player_a_seated_at).toBeTruthy();
    expect(data!.player_b_seated_at).toBeTruthy();
  });

  it("ends a request declined, withdrawn by its sender, or superseded when its recipient leaves for another", async () => {
    const [birna, kari, match] = await both();
    const sent = await request(match, birna);
    expect(await f.rpc("decline_rematch", { p_request: sent.request_id, p_actor: birna })).toEqual({ status: "refused", reason: "not_responder" });
    expect(await f.rpc("decline_rematch", { p_request: sent.request_id, p_actor: kari })).toEqual({ status: "declined" });

    const [embla, jonas, match2] = await both(["Embla", "Jonas"]);
    const second = await request(match2, embla);
    expect(await f.rpc("withdraw_rematch", { p_request: second.request_id, p_actor: embla })).toEqual({ status: "withdrawn" });

    const [anna, oli, match3] = await both(["Anna", "Oli"]);
    const third = await request(match3, anna);
    expect(await f.rpc("withdraw_rematch", { p_request: third.request_id, p_actor: oli })).toEqual({ status: "superseded" });
    void jonas;
  });

  it("expires a request after 30s: accepting it then says so, and the sweep writes when it ran out", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const match = await f.completed(birna, kari);
    const old = await f.rematchRequest(match, birna, kari, 31_000);
    expect((await f.rpc("accept_rematch", { p_request: old, p_actor: kari })).status).toBe("expired");

    const [embla, jonas] = await f.players_(["Embla", "Jonas"]);
    const match2 = await f.completed(embla, jonas);
    await f.onMatch(embla, match2);
    await f.onMatch(jonas, match2);
    const due = await f.rematchRequest(match2, embla, jonas, 31_000);
    const { data } = await db!.client.rpc("expire_due_rematches");
    expect(data as string[]).toContain(match2);
    const { data: row } = await db!.client.from("rematch_requests").select("status, responded_at, expires_at").eq("id", due).single();
    expect(row!.status).toBe("expired");
    expect(Date.parse(row!.responded_at)).toBe(Date.parse(row!.expires_at));
  });

  it("ends a request whose recipient has left the match, with no cooldown", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const match = await f.completed(birna, kari);
    await f.onMatch(birna, match);
    const pending = await f.rematchRequest(match, birna, kari);
    const { data } = await db!.client.rpc("expire_due_rematches");
    expect(data as string[]).toContain(match);
    expect(await f.statusOf("rematch_requests", pending)).toBe("superseded");
    const { data: until } = await db!.client.rpc("pair_cooldown_until", { p_sender: birna, p_recipient: kari });
    expect(until).toBeNull();
  });

  it("ends the request when the accept finds a player at another table", async () => {
    const [birna, kari, match] = await both();
    const sent = await request(match, birna);
    const [embla] = await f.players_(["Embla"]);
    await f.match(kari, embla, "in_progress");
    expect((await f.rpc("accept_rematch", { p_request: sent.request_id, p_actor: kari })).status).toBe("busy");
    expect(await f.statusOf("rematch_requests", sent.request_id as string)).toBe("superseded");
  });
});
