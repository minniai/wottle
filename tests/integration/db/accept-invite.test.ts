/**
 * Spec 067 (T021): accept_invite is a compare-and-set, then create_match_between.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("accept_invite (spec 067)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const accept = (invite: string, actor: string, origin?: string) =>
    f.rpc("accept_invite", { p_invite: invite, p_actor: actor, p_ttl_seconds: 30, ...(origin ? { p_origin: origin } : {}) });

  it("should accept a pending challenge once and create its match", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const invite = await f.invite(birna, kari, { language: "en" });
    const result = await accept(invite, kari);
    expect(result.status).toBe("created");

    const { data } = await db!.client.from("match_invitations").select("status, match_id").eq("id", invite).single();
    expect(data).toEqual({ status: "accepted", match_id: result.match_id });
    const { data: match } = await db!.client.from("matches").select("player_a_id, player_b_id, language, origin, origin_ref").eq("id", result.match_id as string).single();
    expect(match).toEqual({ player_a_id: birna, player_b_id: kari, language: "en", origin: "challenge", origin_ref: invite });

    expect((await accept(invite, kari)).status).toBe("not_pending");
  });

  it("should refuse anyone but the recipient", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const invite = await f.invite(birna, kari);
    expect((await accept(invite, embla)).status).toBe("not_recipient");
    expect((await accept(invite, birna)).status).toBe("not_recipient");
    expect(await f.statusOf("match_invitations", invite)).toBe("pending");
  });

  it("should expire a challenge past its time and create nothing", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const invite = await f.invite(birna, kari, { ageMs: 31_000 });
    expect((await accept(invite, kari)).status).toBe("expired");
    expect(await f.statusOf("match_invitations", invite)).toBe("expired");
    expect(await f.liveMatchesOf(kari)).toBe(0);
  });

  it("should refuse when the sender is in another match, and close the challenge for good", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const invite = await f.invite(birna, embla);
    await f.match(birna, kari, "in_progress");

    expect(await accept(invite, embla)).toEqual({ status: "busy", player_id: birna });
    expect(await f.statusOf("match_invitations", invite)).toBe("superseded");
    expect(await f.liveMatchesOf(embla)).toBe(0);
  });

  it("should refuse when the accepter is in another match, and leave the challenge pending", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const invite = await f.invite(birna, embla);
    await f.match(embla, kari, "in_progress");

    expect(await accept(invite, embla)).toEqual({ status: "busy", player_id: embla });
    expect(await f.statusOf("match_invitations", invite)).toBe("pending");
    expect(await f.liveMatchesOf(birna)).toBe(0);
  });

  it("should record a crossed challenge as such", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const kariToBirna = await f.invite(kari, birna);
    const result = await accept(kariToBirna, birna, "crossed_challenge");
    const { data } = await db!.client.from("matches").select("origin").eq("id", result.match_id as string).single();
    expect(data?.origin).toBe("crossed_challenge");
  });
});
