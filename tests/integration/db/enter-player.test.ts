/**
 * Spec 067 (T036): enter_player claims a name for a device key; resolve_claim
 * finds the name a key entered as most recently. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

const hashOf = (seed: string) => seed.padEnd(64, "0").slice(0, 64);

describe.skipIf(!db)("enter_player and resolve_claim (spec 067)", () => {
  const usernames: string[] = [];
  const name = (base: string) => {
    const u = `t067-e-${base}-${crypto.randomUUID().slice(0, 6)}`;
    usernames.push(u);
    return u;
  };
  const enter = async (username: string, claimHash: string, displayName = "Birna") => {
    const { data, error } = await db!.client.rpc("enter_player", { p_username: username, p_display_name: displayName, p_claim_hash: claimHash });
    if (error) throw new Error(error.message);
    return data as { status: string; player?: { id: string; username: string; display_name: string } };
  };
  const resolve = async (claimHash: string) => {
    const { data, error } = await db!.client.rpc("resolve_claim", { p_claim_hash: claimHash });
    if (error) throw new Error(error.message);
    return data as { status: string; player?: { id: string; username: string } };
  };

  afterEach(async () => {
    await db!.client.from("players").delete().in("username", usernames.splice(0));
  });

  it("should create and claim a new name for the key that entered it", async () => {
    const birna = name("birna");
    const result = await enter(birna, hashOf("a"));
    expect(result.status).toBe("entered");
    expect(result.player).toMatchObject({ username: birna, display_name: "Birna" });
    const { data } = await db!.client.from("players").select("claim_hash, claimed_at, last_entered_at, status").eq("username", birna).single();
    expect(data).toMatchObject({ claim_hash: hashOf("a"), status: "available" });
    expect(data?.claimed_at).toBeTruthy();
    expect(data?.last_entered_at).toBeTruthy();
  });

  it("should let the same key back in and refuse any other, whatever the letter case", async () => {
    const birna = name("birna");
    await enter(birna, hashOf("a"));
    expect((await enter(birna, hashOf("a"))).status).toBe("entered");
    expect(await enter(birna, hashOf("b"))).toEqual({ status: "name_taken" });
    expect(await enter(birna.toUpperCase(), hashOf("b"))).toEqual({ status: "name_taken" });
  });

  it("should give an unclaimed existing player to the first key that enters it", async () => {
    const kari = name("kari");
    await db!.client.from("players").insert({ username: kari, display_name: "Kari", status: "available" });
    expect((await enter(kari, hashOf("c"), "Kari")).status).toBe("entered");
    expect(await enter(kari, hashOf("d"), "Kari")).toEqual({ status: "name_taken" });
  });

  it("should let exactly one of two keys racing for one name have it", async () => {
    const embla = name("embla");
    const results = await Promise.all([enter(embla, hashOf("e")), enter(embla, hashOf("f"))]);
    expect(results.map((r) => r.status).sort()).toEqual(["entered", "name_taken"]);
  });

  it("should never touch the status of a player who is in a match", async () => {
    const jonas = name("jonas");
    await db!.client.from("players").insert({ username: jonas, display_name: "Jonas", status: "in_match", claim_hash: hashOf("g") });
    await enter(jonas, hashOf("g"), "Jonas");
    const { data } = await db!.client.from("players").select("status").eq("username", jonas).single();
    expect(data?.status).toBe("in_match");
  });

  it("should resolve a key to the name it entered as most recently, and an unused key to nothing", async () => {
    const first = name("first");
    const second = name("second");
    await enter(first, hashOf("h"));
    await enter(second, hashOf("h"));
    expect((await resolve(hashOf("h"))).player?.username).toBe(second);
    await enter(first, hashOf("h"));
    expect((await resolve(hashOf("h"))).player?.username).toBe(first);
    expect(await resolve(hashOf("unused"))).toEqual({ status: "unknown" });
  });
});
