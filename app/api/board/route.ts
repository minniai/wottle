import { NextResponse } from "next/server";

import { getBoard } from "../../actions/getBoard";

export const revalidate = 0;

export async function GET() {
  try {
    const board = await getBoard();
    return NextResponse.json(board, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load board from Supabase";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}


