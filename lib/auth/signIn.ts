import "server-only";

import { cookies, headers } from "next/headers";

import { resolveClaim } from "@/lib/auth/claim";
import { DEVICE_COOKIE_NAME } from "@/lib/auth/cookies";
import { deviceKeyFor, rememberEntry } from "@/lib/auth/device";
import { hashDeviceKey } from "@/lib/auth/deviceKey";
import type { ErrorCode } from "@/lib/i18n/copy/types";
import { loginErrorCode } from "@/lib/i18n/errorCodes";
import { enterClaimedPlayer, LoginValidationError, performUsernameLogin, persistLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit, RateLimitExceededError, resolveClientIp } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { Language } from "@/lib/types/game-config";
import type { PlayerIdentity } from "@/lib/types/match";

/**
 * The door's two ways in (spec 067), shared by the door's actions and the
 * invite door's accept (spec 072 research R5): a typed name, or this
 * browser's device key. Each rate-limits, claims, and writes the signed
 * session and the device cookie.
 */
export type SignInResult =
  | { status: "success"; player: PlayerIdentity }
  | { status: "error"; code: ErrorCode; message?: string };

async function limitSignIn(): Promise<void> {
  assertWithinRateLimit({
    identifier: resolveClientIp(await headers()),
    scope: "auth:login",
    limit: 5,
    windowMs: 60_000,
    errorMessage: "Too many login attempts. Please wait up to one minute and try again.",
  });
}

/** Signs in (or claims) the typed name. */
export async function signInWithName(name: string, language: Language): Promise<SignInResult> {
  try {
    await limitSignIn();
    const store = await cookies();
    const deviceKey = deviceKeyFor(store);
    const { player } = await performUsernameLogin(name, language, hashDeviceKey(deviceKey));
    await persistLobbySession({ player }, store);
    rememberEntry(store, deviceKey);
    return { status: "success", player };
  } catch (error) {
    console.error("[signInWithName] sign-in failed", error);
    const code = loginErrorCode(error);
    if (error instanceof RateLimitExceededError || error instanceof LoginValidationError || error instanceof Error) {
      return { status: "error", code, message: error.message };
    }
    return { status: "error", code, message: "Unable to log in right now. Please try again." };
  }
}

/** Signs in this browser's latest player, with nothing typed (the returning door). */
export async function signInAsReturning(language: Language): Promise<SignInResult> {
  try {
    await limitSignIn();
    const store = await cookies();
    const deviceKey = store.get(DEVICE_COOKIE_NAME)?.value;
    if (!deviceKey) return { status: "error", code: "login_failed" };
    const claimed = await resolveClaim(getServiceRoleClient(), hashDeviceKey(deviceKey));
    if (!claimed) {
      store.delete(DEVICE_COOKIE_NAME);
      return { status: "error", code: "login_failed" };
    }
    const player = await enterClaimedPlayer(claimed, language);
    await persistLobbySession({ player }, store);
    rememberEntry(store, deviceKey);
    return { status: "success", player };
  } catch (error) {
    console.error("[signInAsReturning] failed", error);
    return { status: "error", code: error instanceof RateLimitExceededError ? "rate_limited" : "login_failed" };
  }
}
