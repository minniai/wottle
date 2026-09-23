import "server-only";

const MIN_SECRET_BYTES = 32;

/** Thrown instead of ever issuing or accepting an unsigned session (spec 067 FR-002). */
export class SessionSecretMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionSecretMissingError";
  }
}

/** The session signing key from `WOTTLE_SESSION_SECRET` (base64). */
export function requireSessionSecret(): Buffer {
  const raw = process.env.WOTTLE_SESSION_SECRET;
  if (!raw) throw new SessionSecretMissingError("WOTTLE_SESSION_SECRET is not set.");
  const key = Buffer.from(raw, "base64");
  if (process.env.NODE_ENV === "production" && key.length < MIN_SECRET_BYTES) {
    throw new SessionSecretMissingError(`WOTTLE_SESSION_SECRET must decode to at least ${MIN_SECRET_BYTES} bytes.`);
  }
  return key;
}
