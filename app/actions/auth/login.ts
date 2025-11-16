"use server";

import "server-only";

import type { PlayerIdentity } from "../../../lib/types/match";
import {
  LoginValidationError,
  performUsernameLogin,
  persistLobbySession,
} from "../../../lib/matchmaking/profile";

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

  try {
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



