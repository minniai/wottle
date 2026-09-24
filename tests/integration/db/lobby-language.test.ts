/**
 * Spec 070 US7 (T096): one lobby language per player. Entering a lobby switches
 * at once when nothing is out; otherwise it asks, and confirming cancels the
 * search, withdraws the challenge and ends incoming ones as left. A heartbeat
 * never changes it. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { ChallengeFixtures } from "./challengeFixtures";
import { connectTestDb } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("lobby language (spec 070 US7)", () => {
  const f = new ChallengeFixtures(db!);
  afterEach(() => f.dropAll());
  const enter = async (p: string, language: string) => (await db!.client.rpc("enter_lobby", { p_player: p, p_language: language })).data as Record<string, unknown>;
  const languageOf = async (p: string) => (await db!.client.from("players").select("lobby_language").eq("id", p).single()).data!.lobby_language;

  it("switches at once with nothing out, and moves the player's tabs to the new lobby", async () => {
    const [a] = await f.players_(["A"], "is");
    expect(await enter(a, "is")).toEqual({ status: "same" });
    expect(await enter(a, "en")).toEqual({ status: "switched" });
    expect(await languageOf(a)).toBe("en");
    const { data: tabs } = await db!.client.from("presence_tabs").select("language").eq("player_id", a);
    expect(tabs!.every((t) => t.language === "en")).toBe(true);
  });

  it("asks first when a search or a challenge is out, and changes nothing until confirmed", async () => {
    const [a, b, c] = await f.players_(["A", "B", "C"], "is");
    await f.send(a, b);
    await f.send(c, a);
    await db!.client.from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date().toISOString() }).eq("id", a);
    const asked = await enter(a, "en");
    expect(asked.status).toBe("needs_confirm");
    expect((asked.pending as string[]).sort()).toEqual(["incoming", "outgoing", "search"]);
    expect(await languageOf(a)).toBe("is");

    const { data: confirmed } = await db!.client.rpc("confirm_lobby_switch", { p_player: a, p_language: "en" });
    expect((confirmed as { counterparts: string[] }).counterparts.sort()).toEqual([b, c].sort());
    expect(await languageOf(a)).toBe("en");
    const { data: me } = await db!.client.from("players").select("status, queue_language").eq("id", a).single();
    expect(me).toMatchObject({ status: "available", queue_language: null });
    const { data: invites } = await db!.client.from("match_invitations").select("sender_id, status").or(`sender_id.eq.${a},recipient_id.eq.${a}`);
    expect(invites!.find((i) => i.sender_id === a)!.status).toBe("withdrawn");
    expect(invites!.find((i) => i.sender_id === c)!.status).toBe("left");
  });

  it("a heartbeat never changes the lobby language, and a challenge across lobbies is refused", async () => {
    const [a] = await f.players_(["A"], "is");
    const [b] = await f.players_(["B"], "en");
    await db!.client.rpc("beat_tab", { p_player: a, p_tab: crypto.randomUUID(), p_visible: true, p_input_ago_ms: 0, p_page: "rules" });
    expect(await languageOf(a)).toBe("is");
    expect((await f.send(a, b)).status).toBe("other_lobby");
  });
});
