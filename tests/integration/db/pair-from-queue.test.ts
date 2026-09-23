/**
 * Spec 067 (T023): pair_from_queue pairs two searchers through create_match_between.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("pair_from_queue (spec 067)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const pair = (self: string, opponent: string, language = "en") =>
    f.rpc("pair_from_queue", { p_self: self, p_opponent: opponent, p_language: language });

  it("should pair two players searching in the same language", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"], "matchmaking", "en");
    const result = await pair(birna, kari);
    expect(result.status).toBe("created");
    const { data } = await db!.client.from("matches").select("origin, origin_ref, language").eq("id", result.match_id as string).single();
    expect(data).toEqual({ origin: "queue", origin_ref: null, language: "en" });
    expect(await f.player(kari)).toEqual({ status: "in_match", queue_language: null });
  });

  it("should refuse an opponent who stopped searching or searches another language", async () => {
    const [birna] = await f.players_(["Birna"], "matchmaking", "en");
    const [kari] = await f.players_(["Kari"], "available");
    const [embla] = await f.players_(["Embla"], "matchmaking", "is");
    expect((await pair(birna, kari)).status).toBe("not_searching");
    expect((await pair(birna, embla)).status).toBe("not_searching");
    expect(await f.liveMatchesOf(birna)).toBe(0);
  });

  it("should refuse an opponent booked a moment ago", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"], "matchmaking", "en");
    const [embla] = await f.players_(["Embla"]);
    await f.match(kari, embla, "pending");
    expect(await pair(birna, kari)).toEqual({ status: "busy", player_id: kari });
  });
});
