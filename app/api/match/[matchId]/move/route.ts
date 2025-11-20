import { submitMove } from "@/app/actions/match/submitMove";
import { RateLimitExceededError } from "@/lib/rate-limiting/middleware";
import type { MoveResult } from "@/lib/types/board";
import { NextRequest, NextResponse } from "next/server";

const NO_CACHE_HEADERS = {
    "Cache-Control": "no-store",
};

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Request body must be valid JSON." },
            { status: 400, headers: NO_CACHE_HEADERS }
        );
    }

    const payload =
        typeof body === "object" && body && "fromX" in body && "fromY" in body && "toX" in body && "toY" in body
            ? body as { fromX: unknown; fromY: unknown; toX: unknown; toY: unknown }
            : null;

    if (!payload) {
        return NextResponse.json(
            { error: "Request body must contain fromX, fromY, toX, toY." },
            { status: 400, headers: NO_CACHE_HEADERS }
        );
    }

    const { fromX, fromY, toX, toY } = payload;

    if (
        typeof fromX !== "number" ||
        typeof fromY !== "number" ||
        typeof toX !== "number" ||
        typeof toY !== "number"
    ) {
        return NextResponse.json(
            { error: "fromX, fromY, toX, toY must be numbers." },
            { status: 400, headers: NO_CACHE_HEADERS }
        );
    }

    try {
        const result = await submitMove(matchId, fromX, fromY, toX, toY);

        // If result has error property (not MoveResult), return error
        if ("error" in result && !("status" in result)) {
            // Don't log expected errors (400s) - only log unexpected errors (500s)
            return NextResponse.json(
                { error: result.error },
                { status: 400, headers: NO_CACHE_HEADERS }
            );
        }

        // Otherwise, result is a MoveResult (either accepted or rejected)
        const moveResult = result as MoveResult;
        const status = moveResult.status === "accepted" ? 200 : 400;
        // Don't log rejected moves - they're expected business logic responses
        return NextResponse.json(moveResult, { status, headers: NO_CACHE_HEADERS });
    } catch (error) {
        if (error instanceof RateLimitExceededError) {
            return NextResponse.json(
                { error: error.message },
                {
                    status: 429,
                    headers: {
                        ...NO_CACHE_HEADERS,
                        "retry-after": error.retryAfterSeconds.toString(),
                    },
                }
            );
        }

        console.error("POST /api/match/[matchId]/move failed", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to submit move at this time.",
            },
            { status: 500, headers: NO_CACHE_HEADERS }
        );
    }
}
