import { submitMove } from "@/app/actions/match/submitMove";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    const body = await request.json();
    const { fromX, fromY, toX, toY } = body;

    if (
        typeof fromX !== "number" ||
        typeof fromY !== "number" ||
        typeof toX !== "number" ||
        typeof toY !== "number"
    ) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const result = await submitMove(matchId, fromX, fromY, toX, toY);

    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
