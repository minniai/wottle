import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/app/actions/match/previewSwap", () => ({ previewSwap: vi.fn() }));

import { POST } from "@/app/api/match/preview/route";
import { previewSwap } from "@/app/actions/match/previewSwap";
import { RateLimitExceededError } from "@/lib/rate-limiting/middleware";

const SPEC = readFileSync("specs/044-field-ledger-redesign/contracts/preview-swap.openapi.yaml", "utf8");

function request(body: unknown) {
  return new NextRequest("http://localhost/api/match/preview", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/match/preview (contract)", () => {
  beforeEach(() => {
    // Braces matter: returning the mock from the hook would register it as a cleanup fn.
    vi.mocked(previewSwap).mockReset();
  });

  it("200 with words + total on ok, matching PreviewSwapOk", async () => {
    vi.mocked(previewSwap).mockResolvedValue({ status: "ok", words: [{ word: "hestur", points: 24, direction: "ltr" }], total: 24 });
    const res = await POST(request({ kind: "warmup", board: [], from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ status: "ok", words: [{ word: "hestur", points: 24, direction: "ltr" }], total: 24 });
    expect(SPEC).toContain("PreviewSwapOk");
  });

  it.each([
    ["rejected", 400],
    ["unauthenticated", 401],
    ["forbidden", 403],
    ["error", 500],
  ] as const)("maps status %s → HTTP %i", async (status, code) => {
    vi.mocked(previewSwap).mockResolvedValue({ status, error: "x" });
    const res = await POST(request({ kind: "match", matchId: "m", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }));
    expect(res.status).toBe(code);
    expect(SPEC).toContain(`'${code}'`);
  });

  it("400 on invalid JSON", async () => {
    const res = await POST(request("{not json"));
    expect(res.status).toBe(400);
  });

  it("429 with Retry-After when the rate limit throws", async () => {
    vi.mocked(previewSwap).mockImplementation(async () => {
      throw new RateLimitExceededError("match:preview-swap", 17, "slow down");
    });
    const res = await POST(request({ kind: "match", matchId: "m", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("17");
    expect(SPEC).toContain("Retry-After");
  });
});
