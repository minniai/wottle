/**
 * Spec 072 T021: the standing read reports the viewer's link while it is
 * pending, and its outcome for 10s after; never its token or hash.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readStanding } from "@/lib/standing/readStanding";
import { standingFactsSchema } from "@/lib/types/standing";

import { connectTestDb } from "./harness";
import { makeLink } from "./linkFixtures";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
process.env.WOTTLE_SESSION_SECRET ??= Buffer.alloc(32, 3).toString("base64");

describe.skipIf(!db)("the standing read · links (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  it("reports a pending link, then its outcome for 10s, then nothing", async () => {
    const [birna] = await f.players_(["Birna"]);
    const { result, hash } = await makeLink(f, birna);
    const facts = standingFactsSchema.parse(await readStanding(birna));
    expect(facts.link).toEqual({ id: result.link_id, status: "pending", expiresAt: expect.any(String), respondedAt: null, matchId: null });
    expect(JSON.stringify(facts)).not.toMatch(/token|hash|\\\\x/);

    await f.rpc("cancel_link", { p_sender: birna, p_link: result.link_id });
    expect((await readStanding(birna)).link).toMatchObject({ status: "cancelled" });
    await db!.client.from("match_links").update({ responded_at: new Date(Date.now() - 11_000).toISOString() }).eq("token_hash", hash);
    expect((await readStanding(birna)).link).toBeNull();
  });

  it("reports nothing to a player with no link", async () => {
    const [kari] = await f.players_(["Kari"]);
    expect((await readStanding(kari)).link).toBeNull();
  });
});
