import { NextRequest, NextResponse } from "next/server";

import { previewSwap } from "@/app/actions/match/previewSwap";
import { RateLimitExceededError } from "@/lib/rate-limiting/middleware";

const NO_CACHE_HEADERS = { "Cache-Control": "no-store" };

const HTTP_STATUS: Record<string, number> = {
  ok: 200,
  rejected: 400,
  unauthenticated: 401,
  forbidden: 403,
  rate_limited: 429,
  error: 500,
};

/** HTTP wrapper of the `previewSwap` Server Action (specs/044 contracts/preview-swap.openapi.yaml). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "rejected", error: "Request body must be valid JSON." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const result = await previewSwap(body);
    return NextResponse.json(result, { status: HTTP_STATUS[result.status] ?? 500, headers: NO_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { status: "rate_limited", error: error.message },
        { status: 429, headers: { ...NO_CACHE_HEADERS, "retry-after": error.retryAfterSeconds.toString() } },
      );
    }
    console.error("POST /api/match/preview failed", error);
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : "Unable to price the swap." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
