"use server";

import "server-only";

import { headers } from "next/headers";

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

    console.log("loginAction invoked", username);
    const { player, sessionToken } = await performUsernameLogin(
      typeof username === "string" ? username : ""
    );
    await persistLobbySession({ player, sessionToken });

    return {
      status: "success",
      player,
      sessionToken,
    };
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (error instanceof LoginValidationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    console.error("loginAction failed", error);
    return {
      status: "error",
      message: "Unable to log in right now. Please try again.",
    };
  }
}



