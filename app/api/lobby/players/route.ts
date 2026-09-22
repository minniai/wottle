import { NextResponse } from "next/server";

import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import { fetchLobbySnapshot } from "@/lib/matchmaking/profile";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function GET(request?: Request) {
  try {
    const param = request ? new URL(request.url).searchParams.get("language") : null;
    const parsed = playableLanguageSchema.safeParse(param ?? undefined);
    const players = await fetchLobbySnapshot(parsed.success ? parsed.data : "is");
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


