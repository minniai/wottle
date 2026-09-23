import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** The signed session (spec 067): `v1.<base64url JSON>.<base64url HMAC-SHA256 of "v1.<payload>">`. */
const VERSION = "v1";

const sessionPayloadSchema = z.object({
  playerId: z.string().uuid(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export type SessionRejection = "malformed" | "legacy" | "bad_mac" | "expired";

export type SessionVerification =
  | { ok: true; payload: SessionPayload }
  | { ok: false; reason: SessionRejection };

export function signSession(payload: SessionPayload, secret: Buffer): string {
  const body = `${VERSION}.${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
  return `${body}.${macOf(body, secret).toString("base64url")}`;
}

export function verifySession(value: string, secret: Buffer, now: number): SessionVerification {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    return { ok: false, reason: parts.length === 1 && value.length > 0 ? "legacy" : "malformed" };
  }
  if (!parts[1] || !parts[2]) return { ok: false, reason: "malformed" };
  if (!macMatches(`${parts[0]}.${parts[1]}`, parts[2], secret)) return { ok: false, reason: "bad_mac" };
  const payload = parsePayload(parts[1]);
  if (!payload) return { ok: false, reason: "malformed" };
  return payload.expiresAt <= now ? { ok: false, reason: "expired" } : { ok: true, payload };
}

function macOf(body: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

function macMatches(body: string, mac: string, secret: Buffer): boolean {
  const expected = macOf(body, secret);
  const given = Buffer.from(mac, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function parsePayload(encoded: string): SessionPayload | null {
  try {
    const parsed = sessionPayloadSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
