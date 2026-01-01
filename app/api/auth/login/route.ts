import { NextResponse } from "next/server";

import {
  LoginValidationError,
  performUsernameLogin,
  persistLobbySession,
} from "@/lib/matchmaking/profile";
import {
  RateLimitExceededError,
  assertWithinRateLimit,
  resolveClientIp,
} from "@/lib/rate-limiting/middleware";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const username =
    typeof payload === "object" && payload && "username" in payload
      ? (payload as Record<string, unknown>).username
      : undefined;

  if (typeof username !== "string") {
    return NextResponse.json(
      { error: "Username is required." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    assertWithinRateLimit({
      identifier: resolveClientIp(request.headers),
      scope: "auth:login",
      limit: 5,
      windowMs: 60_000,
      errorMessage:
        "Too many login attempts. Please wait up to one minute and try again.",
    });

    const { player, sessionToken } = await performUsernameLogin(username);
    await persistLobbySession({ player, sessionToken });

    return NextResponse.json(
      { player, sessionToken },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
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

    if (error instanceof LoginValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    console.error("POST /api/auth/login failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to authenticate at this time.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}



