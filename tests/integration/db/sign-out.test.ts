/**
 * Spec 067 (T048): sign_out_player never touches a live match; otherwise it
 * withdraws the player's challenges and requests and takes them out of the queue.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("sign_out_player (spec 067)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const signOut = (player: string) => f.rpc("sign_out_player", { p_player: player });

  it.each(["pending", "in_progress"] as const)("should refuse while the player has a %s match, and change nothing", async (state) => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const match = await f.match(birna, kari, state);
    const invite = await f.invite(birna, embla);

    expect(await signOut(birna)).toEqual({ status: "in_match", match_id: match });
    expect(await f.statusOf("match_invitations", invite)).toBe("pending");
    const { data } = await db!.client.from("matches").select("state").eq("id", match).single();
    expect(data?.state).toBe(state);
  });

  it("should withdraw the player's outgoing challenges and rematch requests, and nothing addressed to them", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const toKari = await f.invite(birna, kari);
    const fromEmbla = await f.invite(embla, birna);
    const old = await f.match(birna, kari, "completed");
    const rematch = await f.rematchRequest(old, birna, kari);

    expect(await signOut(birna)).toEqual({ status: "signed_out" });
    expect(await f.statusOf("match_invitations", toKari)).toBe("withdrawn");
    expect(await f.statusOf("match_invitations", fromEmbla)).toBe("pending");
    expect(await f.statusOf("rematch_requests", rematch)).toBe("withdrawn");
  });

  it("should take a searching player out of the queue", async () => {
    const [birna] = await f.players_(["Birna"], "matchmaking", "en");
    await signOut(birna);
    expect(await f.player(birna)).toEqual({ status: "available", queue_language: null });
  });

  it("should leave an available player available", async () => {
    const [birna] = await f.players_(["Birna"]);
    await signOut(birna);
    expect((await f.player(birna)).status).toBe("available");
  });
});
