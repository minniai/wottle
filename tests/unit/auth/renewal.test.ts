// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/claim", () => ({ resolveClaim: vi.fn() }));

import { resolveClaim } from "@/lib/auth/claim";
import { DEVICE_COOKIE_NAME, SESSION_COOKIE_NAME, SIGNED_OUT_COOKIE_NAME } from "@/lib/auth/cookies";
import { hashDeviceKey } from "@/lib/auth/deviceKey";
import { applyRenewal, decideRenewal, renewSession } from "@/lib/auth/renewal";
import { requireSessionSecret } from "@/lib/auth/sessionSecret";
import { signSession, verifySession } from "@/lib/auth/sessionToken";

const BIRNA = { id: "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f", username: "birna", displayName: "Birna" };
const KEY = "k".repeat(43);

function requestWith(cookies: Record<string, string>): NextRequest {
  const header = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  return new NextRequest("http://localhost/en/lobby", { headers: header ? { cookie: header } : {} });
}

function validSession(): string {
  const now = Date.now();
  return signSession({ playerId: BIRNA.id, username: "birna", displayName: "Birna", issuedAt: now, expiresAt: now + 60_000 }, requireSessionSecret());
}

describe("decideRenewal (spec 067 FR-007)", () => {
  it.each([
    [{ sessionValid: true, deviceKey: KEY, signedOut: false }, "pass"],
    [{ sessionValid: false, deviceKey: KEY, signedOut: false }, "resolve"],
    [{ sessionValid: false, deviceKey: KEY, signedOut: true }, "pass"],
    [{ sessionValid: false, deviceKey: null, signedOut: false }, "pass"],
  ] as const)("%o → %s", (input, expected) => {
    expect(decideRenewal(input)).toBe(expected);
  });
});

describe("renewSession (spec 067)", () => {
  beforeEach(() => {
    vi.mocked(resolveClaim).mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("should leave a request with a valid session alone, without touching the database", async () => {
    const outcome = await renewSession(requestWith({ [SESSION_COOKIE_NAME]: validSession(), [DEVICE_COOKIE_NAME]: KEY }));
    expect(outcome).toEqual({ kind: "pass" });
    expect(resolveClaim).not.toHaveBeenCalled();
  });

  it("should sign a new session for the key's player when the session lapsed, visible to this same request", async () => {
    vi.mocked(resolveClaim).mockResolvedValue(BIRNA);
    const request = requestWith({ [DEVICE_COOKIE_NAME]: KEY });
    const outcome = await renewSession(request);

    expect(resolveClaim).toHaveBeenCalledWith(expect.anything(), hashDeviceKey(KEY));
    expect(outcome.kind).toBe("renewed");
    const renewed = request.cookies.get(SESSION_COOKIE_NAME)!.value;
    expect(verifySession(renewed, requireSessionSecret(), Date.now())).toMatchObject({ ok: true, payload: { playerId: BIRNA.id } });

    const response = NextResponse.next();
    applyRenewal(outcome, response);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe(renewed);
    expect(response.cookies.get(DEVICE_COOKIE_NAME)?.value).toBe(KEY);
  });

  it("should renew over a forged or old session too", async () => {
    vi.mocked(resolveClaim).mockResolvedValue(BIRNA);
    const outcome = await renewSession(requestWith({ [SESSION_COOKIE_NAME]: "eyJmb3JnZWQiOnRydWV9", [DEVICE_COOKIE_NAME]: KEY }));
    expect(outcome.kind).toBe("renewed");
  });

  it("should not renew a browser that signed out", async () => {
    const outcome = await renewSession(requestWith({ [DEVICE_COOKIE_NAME]: KEY, [SIGNED_OUT_COOKIE_NAME]: "1" }));
    expect(outcome).toEqual({ kind: "pass" });
    expect(resolveClaim).not.toHaveBeenCalled();
  });

  it("should forget a key that claims no name (FR-008)", async () => {
    vi.mocked(resolveClaim).mockResolvedValue(null);
    const outcome = await renewSession(requestWith({ [DEVICE_COOKIE_NAME]: KEY }));
    expect(outcome).toEqual({ kind: "forget-device" });
    const response = NextResponse.next();
    applyRenewal(outcome, response);
    const cleared = response.cookies.get(DEVICE_COOKIE_NAME);
    expect(cleared?.value).toBe("");
  });

  it("should pass, not fail the page, when the database cannot answer", async () => {
    vi.mocked(resolveClaim).mockRejectedValue(new Error("down"));
    await expect(renewSession(requestWith({ [DEVICE_COOKIE_NAME]: KEY }))).resolves.toEqual({ kind: "pass" });
  });
});
