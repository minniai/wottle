import { describe, expect, it } from "vitest";

import { hashLinkToken, makeLinkToken, parseLinkToken } from "@/lib/matchmaking/linkToken";

/** Spec 072 T008 (research R1): 32 random bytes, only their sha256 stored. */
describe("link tokens", () => {
  it("are 43 URL-safe characters with a 32-byte hash", () => {
    const { token, hash } = makeLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toBeInstanceOf(Buffer);
    expect(hash).toHaveLength(32);
    expect(makeLinkToken().token).not.toBe(token);
  });

  it("hash the same token the same way", () => {
    const { token, hash } = makeLinkToken();
    expect(hashLinkToken(token).equals(hash)).toBe(true);
  });

  it("send the hash as a bytea hex literal", async () => {
    const { toByteaHex } = await import("@/lib/matchmaking/linkToken");
    const { hash } = makeLinkToken();
    expect(toByteaHex(hash)).toBe(`\\x${hash.toString("hex")}`);
  });

  it.each([
    ["too short", "abc"],
    ["too long", "a".repeat(44)],
    ["padded", `${"a".repeat(42)}=`],
    ["not URL-safe", `${"a".repeat(42)}+`],
    ["empty", ""],
    ["not a string", 42],
  ])("refuse a token that is %s, without throwing", (_name, value) => {
    expect(parseLinkToken(value)).toBeNull();
  });

  it("accept a well-formed token", () => {
    const { token } = makeLinkToken();
    expect(parseLinkToken(token)).toBe(token);
  });
});
