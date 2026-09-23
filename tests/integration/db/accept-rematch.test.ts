/**
 * Spec 067 (T022): accept_rematch, the rematch twin of accept_invite.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("accept_rematch (spec 067)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const accept = (request: string, actor: string, origin?: string) =>
    f.rpc("accept_rematch", { p_request: request, p_actor: actor, ...(origin ? { p_origin: origin } : {}) });

  it("should create the rematch in the old match's language and link both ways", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const old = await f.match(birna, kari, "completed", "en");
    const request = await f.rematchRequest(old, birna, kari);

    const result = await accept(request, kari);
    expect(result.status).toBe("created");
    const { data: match } = await db!.client.from("matches").select("language, rematch_of, origin, origin_ref").eq("id", result.match_id as string).single();
    expect(match).toEqual({ language: "en", rematch_of: old, origin: "rematch", origin_ref: request });
    const { data: row } = await db!.client.from("rematch_requests").select("status, new_match_id").eq("id", request).single();
    expect(row).toEqual({ status: "accepted", new_match_id: result.match_id });
  });

  it("should expire a request older than 30 seconds, unless the requests crossed", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const old = await f.match(birna, kari, "completed");
    const request = await f.rematchRequest(old, birna, kari, 31_000);
    expect((await accept(request, kari)).status).toBe("expired");

    const [embla, jonas] = await f.players_(["Embla", "Jonas"]);
    const old2 = await f.match(embla, jonas, "completed");
    const crossed = await f.rematchRequest(old2, embla, jonas, 31_000);
    expect((await accept(crossed, jonas, "crossed_rematch")).status).toBe("created");
  });

  it("should refuse a rematch of a match that is not over", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const live = await f.match(birna, kari, "in_progress");
    const request = await f.rematchRequest(live, birna, kari);
    expect((await accept(request, kari)).status).toBe("not_completed");
  });

  it("should refuse anyone but the responder", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const old = await f.match(birna, kari, "completed");
    const request = await f.rematchRequest(old, birna, kari);
    expect((await accept(request, birna)).status).toBe("not_recipient");
  });

  it("should refuse when either player is in another match, and leave the request pending", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const old = await f.match(birna, kari, "completed");
    const request = await f.rematchRequest(old, birna, kari);
    await f.match(kari, embla, "in_progress");

    expect(await accept(request, kari)).toEqual({ status: "busy", player_id: kari });
    expect(await f.statusOf("rematch_requests", request)).toBe("pending");
    expect(await f.liveMatchesOf(birna)).toBe(0);
  });
});
