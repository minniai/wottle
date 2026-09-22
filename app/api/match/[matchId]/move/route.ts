import { after, NextRequest, NextResponse } from "next/server";

import { resolveReceivedMove, submitMove } from "@/app/actions/match/submitMove";
import { moveRequestSchema } from "@/lib/match/schemas";
import { RateLimitExceededError } from "@/lib/rate-limiting/middleware";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store",
};

/**
 * `POST /api/match/[matchId]/move` (spec 050, contracts/receive-move.md):
 * 200 with the receipt, 400 with a refusal or a bad body, 429 on the rate
 * limit. The board arrives with the resolution, not here.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const parsed = moveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Request body must contain fromX, fromY, toX, toY (0–9) and fromLetter, toLetter." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const result = await submitMove(matchId, parsed.data);
    if (!("status" in result)) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
    }
    if (result.status === "accepted") after(() => resolveReceivedMove(matchId));
    const status = result.status === "accepted" ? 200 : 400;
    return NextResponse.json(result, { status, headers: NO_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { ...NO_CACHE_HEADERS, "retry-after": error.retryAfterSeconds.toString() } },
      );
    }
    console.error("POST /api/match/[matchId]/move failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit move at this time." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
