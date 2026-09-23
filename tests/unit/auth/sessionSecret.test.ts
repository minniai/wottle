import { afterEach, describe, expect, it, vi } from "vitest";

import { requireSessionSecret, SessionSecretMissingError } from "@/lib/auth/sessionSecret";

describe("session secret (spec 067)", () => {
  const original = process.env.WOTTLE_SESSION_SECRET;
  afterEach(() => {
    process.env.WOTTLE_SESSION_SECRET = original;
    vi.unstubAllEnvs();
  });

  it("should throw when the secret is missing", () => {
    delete process.env.WOTTLE_SESSION_SECRET;
    expect(() => requireSessionSecret()).toThrow(SessionSecretMissingError);
  });

  it("should throw in production when the secret decodes to fewer than 32 bytes", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.WOTTLE_SESSION_SECRET = Buffer.alloc(16, 1).toString("base64");
    expect(() => requireSessionSecret()).toThrow(SessionSecretMissingError);
  });

  it("should return the decoded key", () => {
    process.env.WOTTLE_SESSION_SECRET = Buffer.alloc(48, 7).toString("base64");
    const key = requireSessionSecret();
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key).toHaveLength(48);
  });
});
