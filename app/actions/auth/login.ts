"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { PlayerIdentity } from "../../../lib/types/match";
import {
  LoginValidationError,
  performUsernameLogin,
  persistLobbySession,
} from "../../../lib/matchmaking/profile";
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
    await persistLobbySession({ player, sessionToken });

    redirect("/");
  } catch (error) {
    if (error instanceof RateLimitExceededError || error instanceof LoginValidationError) {
      return {
        status: "error",
        message: error.message,
      };
    }
    console.error("loginAction failed", error);
    throw error;
  }
}



