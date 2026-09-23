import { describe, expect, it } from "vitest";

import { signSession, verifySession, type SessionPayload } from "@/lib/auth/sessionToken";

const SECRET = Buffer.from("a-thirty-two-byte-test-secret-for-hmac!!", "utf8");
const NOW = 1_800_000_000_000;

const payload: SessionPayload = {
  playerId: "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f",
  username: "birna",
  displayName: "Birna",
  issuedAt: NOW - 1000,
  expiresAt: NOW + 60_000,
};

function flipAt(value: string, index: number): string {
  const c = value[index] === "A" ? "B" : "A";
  return value.slice(0, index) + c + value.slice(index + 1);
}

describe("session token (spec 067)", () => {
  it("should return the payload when the token is one the server signed", () => {
    expect(verifySession(signSession(payload, SECRET), SECRET, NOW)).toEqual({ ok: true, payload });
  });

  it("should reject a token whose payload was edited", () => {
    const token = signSession(payload, SECRET);
    expect(verifySession(flipAt(token, 5), SECRET, NOW)).toEqual({ ok: false, reason: "bad_mac" });
  });

  it("should reject a token whose signature was edited", () => {
    const token = signSession(payload, SECRET);
    expect(verifySession(flipAt(token, token.length - 3), SECRET, NOW)).toEqual({ ok: false, reason: "bad_mac" });
  });

  it("should reject a token signed with another key", () => {
    const other = Buffer.from("another-thirty-two-byte-secret-value!!!!", "utf8");
    expect(verifySession(signSession(payload, other), SECRET, NOW)).toEqual({ ok: false, reason: "bad_mac" });
  });

  it("should reject the old unsigned base64 JSON cookie as legacy", () => {
    const legacy = Buffer.from(JSON.stringify({ token: "t", player: { id: payload.playerId } }), "utf8").toString("base64url");
    expect(verifySession(legacy, SECRET, NOW)).toEqual({ ok: false, reason: "legacy" });
  });

  it("should reject a token past its expiry", () => {
    const token = signSession({ ...payload, expiresAt: NOW - 1 }, SECRET);
    expect(verifySession(token, SECRET, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("should reject garbage as malformed", () => {
    expect(verifySession("v1.not json.x", SECRET, NOW)).toEqual({ ok: false, reason: "bad_mac" });
    expect(verifySession("v1..", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifySession("", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("should reject a correctly signed payload that is not a session", () => {
    const token = signSession({ ...payload, playerId: "not-a-uuid" } as SessionPayload, SECRET);
    expect(verifySession(token, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });
});
