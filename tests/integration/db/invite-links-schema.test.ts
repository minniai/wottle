/**
 * Spec 072 T003: the table and functions invite links stand on.
 * Live local Supabase; skips without one.
 */
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { hashHex, newToken } from "./linkFixtures";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

describe.skipIf(!db)("invite links schema (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const row = (sender: string, status = "pending") => ({
    token_hash: hashHex(newToken()),
    sender_id: sender,
    language: "is",
    status,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  });

  it("stores a hashed token, a sender, a language and an expiry", async () => {
    const [birna] = await f.players_(["Birna"]);
    const inserted = await db!.client.from("match_links").insert(row(birna)).select("*").single();
    expect(inserted.error).toBeNull();
    expect(Object.keys(inserted.data!).sort()).toEqual(
      ["created_at", "expires_at", "id", "language", "match_id", "responded_at", "sender_id", "status", "token_hash", "used_by"].sort(),
    );
    const badLanguage = await db!.client.from("match_links").insert({ ...row(birna, "cancelled"), language: "dk" });
    expect(badLanguage.error?.message).toMatch(/match_links_language_check/);
    const badStatus = await db!.client.from("match_links").insert(row(birna, "open"));
    expect(badStatus.error?.message).toMatch(/match_links_status_check/);
  });

  it("keeps each token unique and one pending link per sender", async () => {
    const [birna] = await f.players_(["Birna"]);
    const first = row(birna);
    expect((await db!.client.from("match_links").insert(first)).error).toBeNull();
    const sameHash = await db!.client.from("match_links").insert({ ...row(birna, "cancelled"), token_hash: first.token_hash });
    expect(sameHash.error?.message).toMatch(/duplicate key/);
    const secondPending = await db!.client.from("match_links").insert(row(birna));
    expect(secondPending.error?.message).toMatch(/duplicate key/);
    expect((await db!.client.from("match_links").insert(row(birna, "expired"))).error).toBeNull();
  });

  it("is hidden from the browser's key", async () => {
    const [birna] = await f.players_(["Birna"]);
    await db!.client.from("match_links").insert(row(birna));
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data } = await anon.from("match_links").select("id").eq("sender_id", birna);
    expect(data ?? []).toHaveLength(0);
    const call = await anon.rpc("read_link", { p_token_hash: hashHex(newToken()) });
    expect(call.error).not.toBeNull();
  });

  it.each([
    ["create_link", { p_sender: crypto.randomUUID(), p_token_hash: hashHex(newToken()), p_ttl_seconds: 600 }],
    ["read_link", { p_token_hash: hashHex(newToken()) }],
    ["accept_link", { p_token_hash: hashHex(newToken()), p_actor: crypto.randomUUID() }],
    ["cancel_link", { p_sender: crypto.randomUUID(), p_link: crypto.randomUUID() }],
    ["expire_links", {}],
    ["best_words", { p_player: crypto.randomUUID(), p_language: "is", p_limit: 3 }],
    ["presence_word", { p_player: crypto.randomUUID(), p_language: "is" }],
  ])("the server may call %s", async (name, args) => {
    const { error } = await db!.client.rpc(name, args);
    expect(error).toBeNull();
  });
});
