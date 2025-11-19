import { submitMove } from "@/app/actions/match/submitMove";
import { NextRequest, NextResponse } from "next/server";
import type { MoveResult } from "@/lib/types/board";

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
            console.error(`Move submission failed for match ${matchId}:`, result.error);
            return NextResponse.json(
                { error: result.error },
                { status: 400, headers: NO_CACHE_HEADERS }
            );
    }

        // Otherwise, result is a MoveResult (either accepted or rejected)
        const moveResult = result as MoveResult;
        const status = moveResult.status === "accepted" ? 200 : 400;
        if (moveResult.status === "rejected") {
            console.log(`Move rejected for match ${matchId}:`, moveResult.error);
        }
        return NextResponse.json(moveResult, { status, headers: NO_CACHE_HEADERS });
    } catch (error) {
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
