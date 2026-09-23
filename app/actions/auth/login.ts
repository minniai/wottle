"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { PlayerIdentity } from "@/lib/types/match";
import {
  LoginValidationError,
  performUsernameLogin,
  persistLobbySession,
  viewerInLanguage,
} from "@/lib/matchmaking/profile";
import type { ErrorCode } from "@/lib/i18n/copy/types";
import { loginErrorCode } from "@/lib/i18n/errorCodes";
import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import {
  RateLimitExceededError,
  assertWithinRateLimit,
  resolveClientIp,
} from "@/lib/rate-limiting/middleware";

export interface LoginActionState {
  status: "idle" | "success" | "error";
  /** What the room shows, in the page's language (spec 060); `message` stays English for logs and tests. */
  code?: ErrorCode;
  message?: string;
  player?: PlayerIdentity;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const username = formData.get("username");
  const ipHeaders = await headers();
  const ipAddress = resolveClientIp(ipHeaders);

  try {
    assertWithinRateLimit({
      identifier: ipAddress,
      scope: "auth:login",
      limit: 5,
      windowMs: 60_000,
      errorMessage:
        "Too many login attempts. Please wait up to one minute and try again.",
    });

    const language = playableLanguageSchema.safeParse(formData.get("language") ?? undefined);
    const { player } = await performUsernameLogin(
      typeof username === "string" ? username : "",
      language.success ? language.data : "is",
    );
    await persistLobbySession({ player });

    // No revalidatePath("/"): the room converts the bar in place and rewrites the URL to /lobby
    // (spec 044 US7). A server re-render of / here would hit its signed-in redirect and remount the field.
    // The bar shows the rating of the lobby the player signed in to (spec 060 US4).
    const shown = await viewerInLanguage(player, language.success ? language.data : "is");
    return { status: "success", player: shown };
  } catch (error) {
    console.error("[loginAction] sign-in failed", error);

    const code = loginErrorCode(error);
    if (error instanceof RateLimitExceededError || error instanceof LoginValidationError || error instanceof Error) {
      return { status: "error", code, message: error.message };
    }
    return { status: "error", code, message: "Unable to log in right now. Please try again." };
  }
}