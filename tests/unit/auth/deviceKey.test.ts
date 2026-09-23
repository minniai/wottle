import { describe, expect, it } from "vitest";

import { hashDeviceKey, newDeviceKey } from "@/lib/auth/deviceKey";

describe("device key (spec 067)", () => {
  it("should be 32 random bytes in base64url", () => {
    const key = newDeviceKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(key, "base64url")).toHaveLength(32);
  });

  it("should never repeat", () => {
    const keys = new Set(Array.from({ length: 1000 }, () => newDeviceKey()));
    expect(keys.size).toBe(1000);
  });

  it("should hash to 64 hex characters, the same every time", () => {
    const key = newDeviceKey();
    expect(hashDeviceKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeviceKey(key)).toBe(hashDeviceKey(key));
    expect(hashDeviceKey(key)).not.toBe(hashDeviceKey(newDeviceKey()));
  });
});
