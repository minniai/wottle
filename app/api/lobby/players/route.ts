import { NextResponse } from "next/server";

import { fetchLobbySnapshot } from "@/lib/matchmaking/profile";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function GET() {
  try {
    const players = await fetchLobbySnapshot();
    return NextResponse.json({ players }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("Failed to load lobby snapshot", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load lobby snapshot.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}


