/**
 * Spec 070 T062: sending, accepting, withdrawing, crossing and pairing, fired
 * at the same players at once. A player never holds two pending outgoing
 * challenges, no match ever takes a busy player, every challenge ends in one
 * status, and nothing deadlocks. Live local Supabase; skips without one.
 */
import { afterAll, describe, expect, it } from "vitest";

import { ChallengeFixtures } from "./challengeFixtures";
import { connectTestDb } from "./harness";

const db = await connectTestDb();
const ROUNDS = 100;

function shuffle<T>(items: T[]): T[] {
  return items.map((item) => ({ item, key: Math.random() })).sort((x, y) => x.key - y.key).map(({ item }) => item);
}

describe.skipIf(!db)("challenges under contention (spec 070)", () => {
  const f = new ChallengeFixtures(db!);
  afterAll(() => f.dropAll());

  it(`holds its invariants across ${ROUNDS} rounds`, async () => {
    const rpc = (fn: string, args: Record<string, unknown>) => db!.client.rpc(fn, args).then((r) => r.data);
    for (let round = 0; round < ROUNDS; round += 1) {
      const [a, b, c] = await f.players_([`A${round}`, `B${round}`, `C${round}`]);
      const aToB = (await f.send(a, b)) as { invite_id: string };
      const cToA = (await f.send(c, a)) as { invite_id: string };
      await db!.client.from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date().toISOString() }).eq("id", b);

      await Promise.all(
        shuffle([
          () => rpc("send_challenge", { p_sender: a, p_recipient: c }),
          () => rpc("send_challenge", { p_sender: b, p_recipient: a }),
          () => rpc("accept_invite", { p_invite: aToB.invite_id, p_actor: b, p_ttl_seconds: 60 }),
          () => rpc("accept_invite", { p_invite: cToA.invite_id, p_actor: a, p_ttl_seconds: 60 }),
          () => rpc("withdraw_challenge", { p_sender: a, p_invite: aToB.invite_id }),
          () => rpc("send_challenge", { p_sender: c, p_recipient: b }),
        ]).map((attempt) => attempt()),
      );

      const { data: invites } = await db!.client.from("match_invitations").select("sender_id, status").in("sender_id", [a, b, c]);
      for (const sender of [a, b, c]) {
        expect(invites!.filter((i) => i.sender_id === sender && i.status === "pending").length, `round ${round}: one outgoing`).toBeLessThanOrEqual(1);
      }
      const { data: live } = await db!.client.from("matches").select("player_a_id, player_b_id").in("state", ["pending", "in_progress"]).or(`player_a_id.in.(${[a, b, c].join(",")}),player_b_id.in.(${[a, b, c].join(",")})`);
      for (const p of [a, b, c]) {
        expect(live!.filter((m) => m.player_a_id === p || m.player_b_id === p).length, `round ${round}: one match`).toBeLessThanOrEqual(1);
      }
      // Anyone at a table holds no pending challenge either way.
      const booked = new Set(live!.flatMap((m) => [m.player_a_id, m.player_b_id]));
      const { data: open } = await db!.client.from("match_invitations").select("sender_id, recipient_id").eq("status", "pending").or(`sender_id.in.(${[a, b, c].join(",")}),recipient_id.in.(${[a, b, c].join(",")})`);
      for (const i of open!) expect(booked.has(i.sender_id) || booked.has(i.recipient_id), `round ${round}: nobody booked is challenged`).toBe(false);
    }
  }, 300_000);
});
