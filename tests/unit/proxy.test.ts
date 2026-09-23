// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/claim", () => ({ resolveClaim: vi.fn() }));

import { resolveClaim } from "@/lib/auth/claim";
import { DEVICE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { config, proxy } from "@/proxy";

const BIRNA = { id: "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f", username: "birna", displayName: "Birna" };

function request(path: string, cookie = ""): NextRequest {
  return new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });
}

describe("proxy (spec 060 locales, spec 067 renewal)", () => {
  beforeEach(() => {
    vi.mocked(resolveClaim).mockReset().mockResolvedValue(BIRNA);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("should renew a lapsed session on an API request, which now passes through the proxy", async () => {
    const response = await proxy(request("/api/match/active", `${DEVICE_COOKIE_NAME}=${"k".repeat(43)}`));
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toMatch(/^v1\./);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(new RegExp(config.matcher[0]).source).toContain("_next");
  });

  it("should renew on a page and still rewrite it into the default locale", async () => {
    const response = await proxy(request("/lobby", `${DEVICE_COOKIE_NAME}=${"k".repeat(43)}`));
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toMatch(/^v1\./);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/is/lobby");
    // The page behind the rewrite reads the renewed session in this same request.
    expect(response.headers.get("x-middleware-request-cookie") ?? response.headers.get("x-middleware-override-headers")).toBeTruthy();
  });

  it("should keep redirecting the explicit default-locale prefix", async () => {
    const response = await proxy(request("/is/lobby"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost/lobby");
  });

  it("should not touch the database for a browser without a device key", async () => {
    await proxy(request("/en/lobby"));
    expect(resolveClaim).not.toHaveBeenCalled();
  });
});
