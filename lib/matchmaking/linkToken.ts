import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { LINK_TOKEN_BYTES } from "@/lib/constants/links";

/** Base64url of 32 bytes, unpadded: exactly 43 characters. */
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export interface LinkToken {
  token: string;
  hash: Buffer;
}

/** A new link's token; the server keeps only its hash (research R1). */
export function makeLinkToken(): LinkToken {
  const token = randomBytes(LINK_TOKEN_BYTES).toString("base64url");
  return { token, hash: hashLinkToken(token) };
}

export function hashLinkToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

/** The hash as PostgREST takes a bytea argument. */
export function toByteaHex(hash: Buffer): string {
  return `\\x${hash.toString("hex")}`;
}

/** The token when it is well formed, null otherwise: a malformed link reads as expired with no query. */
export function parseLinkToken(value: unknown): string | null {
  const parsed = tokenSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
