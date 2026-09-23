import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deviceCookieOptions,
  DEVICE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signedOutCookieOptions,
  SIGNED_OUT_COOKIE_NAME,
} from "@/lib/auth/cookies";

const YEAR = 365 * 24 * 60 * 60;

describe("identity cookies (spec 067)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("should name the three cookies", () => {
    expect([SESSION_COOKIE_NAME, DEVICE_COOKIE_NAME, SIGNED_OUT_COOKIE_NAME]).toEqual([
      "wottle-playtest-session",
      "wottle-device",
      "wottle-signed-out",
    ]);
  });

  it("should keep the session four hours and the device key and the signed-out mark a year", () => {
    expect(sessionCookieOptions().maxAge).toBe(4 * 60 * 60);
    expect(deviceCookieOptions().maxAge).toBe(YEAR);
    expect(signedOutCookieOptions().maxAge).toBe(YEAR);
  });

  it("should make every cookie httpOnly, lax and site-wide", () => {
    for (const options of [sessionCookieOptions(), deviceCookieOptions(), signedOutCookieOptions()]) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    }
  });

  it("should be Secure in production unless PLAYTEST_SESSION_SECURE says otherwise", () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYTEST_SESSION_SECURE", "");
    expect(deviceCookieOptions().secure).toBe(true);
    vi.stubEnv("PLAYTEST_SESSION_SECURE", "false");
    expect(deviceCookieOptions().secure).toBe(false);
  });

  it("should not be Secure in CI", () => {
    vi.stubEnv("PLAYTEST_SESSION_SECURE", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CI", "true");
    expect(sessionCookieOptions().secure).toBe(false);
  });
});
