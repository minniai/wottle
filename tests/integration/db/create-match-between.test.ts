/**
 * Spec 067 (T020): create_match_between is the one way to make a match.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("create_match_between (spec 067)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const create = (a: string, b: string, origin = "challenge", ref: string | null = null, language = "is") =>
    f.rpc("create_match_between", { p_a: a, p_b: b, p_language: language, p_origin: origin, p_ref: ref });

  it("should create the match and book both players", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const result = await create(birna, kari, "challenge", null, "en");
    expect(result.status).toBe("created");

    const { data: match } = await db!.client.from("matches").select("*").eq("id", result.match_id as string).single();
    expect(match).toMatchObject({ player_a_id: birna, player_b_id: kari, language: "en", state: "pending", origin: "challenge" });
    expect(await f.player(birna)).toEqual({ status: "in_match", queue_language: null });
    expect(await f.player(kari)).toEqual({ status: "in_match", queue_language: null });
    const { data: presence } = await db!.client.from("lobby_presence").select("mode").in("player_id", [birna, kari]);
    expect(presence?.map((p) => p.mode)).toEqual(["auto", "auto"]);
  });

  it("should withdraw both players' other outgoing challenges and supersede the ones addressed to them", async () => {
    const [birna, kari, embla, jonas] = await f.players_(["Birna", "Kari", "Embla", "Jonas"]);
    const cause = await f.invite(birna, kari);
    const birnaToEmbla = await f.invite(birna, embla);
    const jonasToKari = await f.invite(jonas, kari);
    const emblaToJonas = await f.invite(embla, jonas);

    expect((await create(birna, kari, "challenge", cause)).status).toBe("created");
    expect(await f.statusOf("match_invitations", cause)).toBe("pending");
    expect(await f.statusOf("match_invitations", birnaToEmbla)).toBe("withdrawn");
    expect(await f.statusOf("match_invitations", jonasToKari)).toBe("superseded");
    expect(await f.statusOf("match_invitations", emblaToJonas)).toBe("pending");
  });

  it("should withdraw and supersede pending rematch requests the same way", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const old1 = await f.match(birna, embla, "completed");
    const old2 = await f.match(embla, kari, "completed");
    const birnaAsks = await f.rematchRequest(old1, birna, embla);
    const emblaAsksKari = await f.rematchRequest(old2, embla, kari);

    expect((await create(birna, kari)).status).toBe("created");
    expect(await f.statusOf("rematch_requests", birnaAsks)).toBe("withdrawn");
    expect(await f.statusOf("rematch_requests", emblaAsksKari)).toBe("superseded");
  });

  it("should refuse when either player already has a live match, and write nothing", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    await f.match(birna, kari, "in_progress");
    const emblaToKari = await f.invite(embla, kari);

    expect(await create(embla, birna)).toEqual({ status: "busy", player_id: birna });
    expect(await f.liveMatchesOf(embla)).toBe(0);
    expect((await f.player(embla)).status).toBe("available");
    expect(await f.statusOf("match_invitations", emblaToKari)).toBe("pending");
  });

  it("should count a pending match as live", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    await f.match(birna, kari, "pending");
    expect(await create(kari, embla)).toEqual({ status: "busy", player_id: kari });
  });

  it("should refuse the same player twice, an unknown player, a bad language or origin", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    expect((await create(birna, birna)).status).toBe("invalid");
    expect((await create(birna, crypto.randomUUID())).status).toBe("invalid");
    expect((await create(birna, kari, "challenge", null, "dk")).status).toBe("invalid");
    expect((await create(birna, kari, "walk_in")).status).toBe("invalid");
  });

  it("should record what caused the match", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const cause = await f.invite(birna, kari);
    const result = await create(birna, kari, "crossed_challenge", cause);
    const { data } = await db!.client.from("matches").select("origin, origin_ref").eq("id", result.match_id as string).single();
    expect(data).toEqual({ origin: "crossed_challenge", origin_ref: cause });
  });
});
