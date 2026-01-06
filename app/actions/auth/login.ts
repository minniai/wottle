"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { PlayerIdentity } from "@/lib/types/match";
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

export interface LoginActionState {
  status: "idle" | "success" | "error";
  message?: string;
  player?: PlayerIdentity;
  sessionToken?: string;
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

    const { player, sessionToken } = await performUsernameLogin(
      typeof username === "string" ? username : ""
    );
    console.log(`[LOGIN_DEBUG] performUsernameLogin success. Player: ${player.id}, Token: ${sessionToken.slice(0, 10)}...`);
    
    await persistLobbySession({ player, sessionToken });
    console.log(`[LOGIN_DEBUG] persistLobbySession complete. Redirecting...`);
    
    redirect("/");
  } catch (error) {
    // Re-throw redirect errors - Next.js handles these specially
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" ||
       (error as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))) {
      throw error;
    }

    console.error(`[LOGIN_DEBUG] Error during login:`, error);

    if (error instanceof RateLimitExceededError || error instanceof LoginValidationError || error instanceof Error) {
      return { status: "error", message: error.message };
    } else {
      return { status: "error", message: "Unable to log in right now. Please try again." };
    };
  }
}