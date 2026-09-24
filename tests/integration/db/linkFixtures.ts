/**
 * Spec 072: invite links for the database tests. A token is 32 random bytes;
 * the database only ever sees its sha256, sent as a bytea hex literal.
 */
import { createHash, randomBytes } from "node:crypto";

import type { Fixtures, Rpc } from "./matchCreation.fixtures";

export const LINK_TTL_SECONDS = 600;

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashHex(token: string): string {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}

export interface MadeLink {
  token: string;
  hash: string;
  result: Rpc;
}

export async function makeLink(f: Fixtures, senderId: string, ttlSeconds = LINK_TTL_SECONDS): Promise<MadeLink> {
  const token = newToken();
  const hash = hashHex(token);
  const result = await f.rpc("create_link", { p_sender: senderId, p_token_hash: hash, p_ttl_seconds: ttlSeconds });
  return { token, hash, result };
}

export const acceptLink = (f: Fixtures, hash: string, actor: string): Promise<Rpc> =>
  f.rpc("accept_link", { p_token_hash: hash, p_actor: actor });

export const readLink = (f: Fixtures, hash: string): Promise<Rpc> => f.rpc("read_link", { p_token_hash: hash });
