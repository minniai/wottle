import { NextResponse } from "next/server";

import { swapTiles } from "@/app/actions/swapTiles";
import type { MoveRequest } from "@/lib/types/board";

export const runtime = "edge";
export const revalidate = 0;

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as MoveRequest;
    const result = await swapTiles(payload);

    if (result.status === "rejected") {
      return jsonResponse(result, 400);
    }

    return jsonResponse(result, 200);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process swap request.";
    return jsonResponse({ error: message }, 500);
  }
}


