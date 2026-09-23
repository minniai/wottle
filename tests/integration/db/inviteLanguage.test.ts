/**
 * Spec 060 US3: a challenge carries the language of the lobby it was sent
 * from, accepting it creates a match in that language, and a player present in
 * another language's lobby cannot be challenged. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { respondToInvite, sendDirectInvite } from "@/lib/matchmaking/inviteService";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

async function createPlayers(names: string[], lobby: Record<string, "is" | "en">): Promise<string[]> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const { data, error } = await db!.client
    .from("players")
    .insert(names.map((n) => ({ username: `tlang-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available" })))
    .select("id, display_name");
  if (error || !data) throw new Error(`players.insert: ${error?.message}`);
  const ids = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
  const expires = new Date(Date.now() + 60_000).toISOString();
  const { error: presenceError } = await db!.client.from("lobby_presence").insert(
    names.map((n, i) => ({ player_id: ids[i], connection_id: crypto.randomUUID(), mode: "auto", expires_at: expires, language: lobby[n] })),
  );
  if (presenceError) throw new Error(`lobby_presence.insert: ${presenceError.message}`);
  return ids;
}

describe.skipIf(!db)("challenges by language (spec 060)", () => {
  let players: string[] = [];

  afterEach(async () => {
    const { data } = await db!.client.from("match_invitations").select("match_id").in("recipient_id", players);
    const matchIds = (data ?? []).map((r) => r.match_id).filter(Boolean);
    if (matchIds.length) await db!.client.from("matches").delete().in("id", matchIds);
    await db!.client.from("players").delete().in("id", players);
  });

  it("a challenge from the English lobby is English, and so is the match it opens", async () => {
    players = await createPlayers(["Anna", "Ben"], { Anna: "en", Ben: "en" });
    const [anna, ben] = players;
    const sent = await sendDirectInvite(db!.client, { senderId: anna, recipientId: ben, language: "en" });
    if (sent.status !== "sent") throw new Error("expected a sent challenge");
    const { data: invite } = await db!.client.from("match_invitations").select("language").eq("id", sent.inviteId).single();
    expect(invite?.language).toBe("en");

    const answer = await respondToInvite(db!.client, { inviteId: sent.inviteId, actorId: ben, decision: "accepted" });
    const { data: match } = await db!.client.from("matches").select("language").eq("id", answer.status === "accepted" ? answer.matchId : "").single();
    expect(match?.language).toBe("en");
  });

  it("a player in the Icelandic lobby cannot be challenged from the English one", async () => {
    players = await createPlayers(["Anna", "Kari"], { Anna: "en", Kari: "is" });
    const [anna, kari] = players;
    await expect(sendDirectInvite(db!.client, { senderId: anna, recipientId: kari, language: "en" })).rejects.toThrow(/another language/i);
  });
});
