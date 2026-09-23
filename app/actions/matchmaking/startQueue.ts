"use server";

import "server-only";

import { z } from "zod";

import type { Attention } from "@/lib/matchmaking/attention";
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
  queuedAt?: string;
  until?: string;
  message?: string;
}

const attentionSchema = z.object({ visible: z.boolean(), inputAgoMs: z.number().int().nonnegative() });

/**
 * Spec 060: the queue is the lobby's language; a player is paired only within it.
 * Spec 069: each poll carries the tab's attention; a hidden tab pauses the search.
 */
export async function startQueueAction(input: { language?: string; attention?: Attention; resume?: boolean } = {}): Promise<QueueActionState> {
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
    const attention = attentionSchema.safeParse(input.attention);
    const result = await startAutoQueue(supabase, {
      playerId: session.player.id,
      language: parsed.data,
      ...(attention.success ? { attention: attention.data } : {}),
      ...(input.resume === true ? { resume: true } : {}),
    });
    return result;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Matchmaking failed.",
    };
  }
}


