/**
 * Spec 060, spec 070 FR-033: a challenge is made within one lobby. It carries
 * the sender's lobby language, so does the match it opens, and a player in the
 * other lobby cannot be challenged. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/realtime/pokes", () => ({ pokePlayer: vi.fn(), pokePlayers: vi.fn(), pokeLobby: vi.fn() }));

import { respondChallenge, sendChallenge } from "@/lib/matchmaking/challengeService";

import { ChallengeFixtures } from "./challengeFixtures";
import { connectTestDb } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("challenges by language (spec 060, spec 070)", () => {
  const f = new ChallengeFixtures(db!);
  afterEach(() => f.dropAll());

  it("a challenge from the English lobby is English, and so is the match it opens", async () => {
    const [anna, ben] = await f.players_(["Anna", "Ben"], "en");
    const sent = await sendChallenge(anna, ben);
    if (sent.status !== "sent") throw new Error(`expected a sent challenge, got ${sent.status}`);
    expect((await f.invite(sent.inviteId)).language).toBe("en");
    const answer = await respondChallenge(ben, sent.inviteId, "accept");
    if (answer.status !== "accepted") throw new Error(`expected an accept, got ${answer.status}`);
    const { data: match } = await db!.client.from("matches").select("language").eq("id", answer.matchId).single();
    expect(match?.language).toBe("en");
  });

  it("a player in the Icelandic lobby cannot be challenged from the English one", async () => {
    const [anna] = await f.players_(["Anna"], "en");
    const [kari] = await f.players_(["Kari"], "is");
    expect((await sendChallenge(anna, kari)).status).toBe("other_lobby");
  });
});
