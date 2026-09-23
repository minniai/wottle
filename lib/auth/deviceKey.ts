import "server-only";

import { createHash, randomBytes } from "node:crypto";

const DEVICE_KEY_BYTES = 32;

/** The secret this browser keeps; its hash is the claim on every name it entered as (spec 067). */
export function newDeviceKey(): string {
  return randomBytes(DEVICE_KEY_BYTES).toString("base64url");
}

/** A fast hash is enough: the key carries 256 bits of entropy (research R2). */
export function hashDeviceKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}
