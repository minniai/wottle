"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";

export interface LogoutInput {
  resignActiveMatch?: boolean;
}

export interface LogoutResult {
  status: "signed-out";
  resignedMatchId: string | null;
}

export async function logoutAction(
  _input: LogoutInput = {},
): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "signed-out", resignedMatchId: null };
  }
  // Rest of implementation lands in later tasks.
  return { status: "signed-out", resignedMatchId: null };
}
