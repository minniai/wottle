"use server";

import "server-only";

import { cookies, headers } from "next/headers";

import type { LoginActionState } from "@/app/actions/auth/login";
import { resolveClaim } from "@/lib/auth/claim";
import { DEVICE_COOKIE_NAME } from "@/lib/auth/cookies";
import { rememberEntry } from "@/lib/auth/device";
import { hashDeviceKey } from "@/lib/auth/deviceKey";
import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import { enterClaimedPlayer, persistLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit, RateLimitExceededError, resolveClientIp } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * `enter the lobby ▸` on the returning door (spec 067 FR-010): this browser's
 * device key alone signs its latest player in, with nothing typed.
 */
export async function enterAsReturningAction(language: string): Promise<LoginActionState> {
  try {
    assertWithinRateLimit({
      identifier: resolveClientIp(await headers()),
      scope: "auth:login",
      limit: 5,
      windowMs: 60_000,
      errorMessage: "Too many login attempts. Please wait up to one minute and try again.",
    });
    const lobby = playableLanguageSchema.safeParse(language);
    const store = await cookies();
    const deviceKey = store.get(DEVICE_COOKIE_NAME)?.value;
    if (!deviceKey) return { status: "error", code: "login_failed" };

    const claimed = await resolveClaim(getServiceRoleClient(), hashDeviceKey(deviceKey));
    if (!claimed) {
      store.delete(DEVICE_COOKIE_NAME);
      return { status: "error", code: "login_failed" };
    }
    const player = await enterClaimedPlayer(claimed, lobby.success ? lobby.data : "is");
    await persistLobbySession({ player }, store);
    rememberEntry(store, deviceKey);
    return { status: "success", player };
  } catch (error) {
    console.error("[enterAsReturningAction] failed", error);
    return { status: "error", code: error instanceof RateLimitExceededError ? "rate_limited" : "login_failed" };
  }
}
