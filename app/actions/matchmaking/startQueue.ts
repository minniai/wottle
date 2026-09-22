"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import {
  startAutoQueue,
  type QueueResult,
} from "@/lib/matchmaking/inviteService";
import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface QueueActionState {
  status: QueueResult["status"] | "error" | "unauthenticated";
  matchId?: string;
  estimatedWaitSeconds?: number;
  message?: string;
}

/** Spec 060: the queue is the lobby's language; a player is paired only within it. */
export async function startQueueAction(input: { language?: string } = {}): Promise<QueueActionState> {
  const parsed = playableLanguageSchema.safeParse(input.language);
  if (!parsed.success) return { status: "error", message: "Unsupported language." };
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
      language: parsed.data,
    });
    return result;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Matchmaking failed.",
    };
  }
}


