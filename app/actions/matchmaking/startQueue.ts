"use server";

import "server-only";

import { readLobbySession } from "../../../lib/matchmaking/profile";
import {
  startAutoQueue,
  type QueueResult,
} from "../../../lib/matchmaking/inviteService";
import { getServiceRoleClient } from "../../../lib/supabase/server";

export interface QueueActionState {
  status: QueueResult["status"] | "error" | "unauthenticated";
  matchId?: string;
  estimatedWaitSeconds?: number;
  message?: string;
}

export async function startQueueAction(): Promise<QueueActionState> {
  const session = await readLobbySession();
  if (!session) {
    return {
      status: "unauthenticated",
      message: "Log in to join matchmaking.",
    };
  }

  try {
    const supabase = getServiceRoleClient();
    const result = await startAutoQueue(supabase, {
      playerId: session.player.id,
    });
    return result;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Matchmaking failed.",
    };
  }
}


