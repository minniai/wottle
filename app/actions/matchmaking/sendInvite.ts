"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import {
  respondToInvite,
  sendDirectInvite,
  type RespondInviteResult,
  type SendDirectInviteResult,
} from "@/lib/matchmaking/inviteService";
import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import { inviteTtlSeconds } from "@/lib/match/createMatch";
import { getServiceRoleClient } from "@/lib/supabase/server";

type Failure = { status: "error" | "unauthenticated"; message: string };

/** Sent, or accepted at once when the recipient had already challenged you (spec 067). */
export type InviteActionState = SendDirectInviteResult | Failure;

export type InviteDecisionState = RespondInviteResult | Failure;

export async function sendInviteAction(
  recipientId: string,
  language?: string,
): Promise<InviteActionState> {
  const parsedLanguage = playableLanguageSchema.safeParse(language);
  if (!parsedLanguage.success) {
    return { status: "error", message: "Unsupported language." };
  }
  if (!recipientId) {
    return { status: "error", message: "Recipient is required." };
  }

  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated", message: "Log in to send invites." };
  }

  try {
    const supabase = getServiceRoleClient();
    return await sendDirectInvite(supabase, {
      senderId: session.player.id,
      recipientId,
      ttlSeconds: inviteTtlSeconds(),
      language: parsedLanguage.data,
    });
  } catch (error) {
    return { status: "error", message: normalizeError(error) };
  }
}

export async function respondInviteAction(
  inviteId: string,
  decision: "accepted" | "declined"
): Promise<InviteDecisionState> {
  const session = await readLobbySession();
  if (!session) {
    return {
      status: "unauthenticated",
      message: "Log in to manage invites.",
    };
  }

  try {
    const supabase = getServiceRoleClient();
    return await respondToInvite(supabase, {
      inviteId,
      actorId: session.player.id,
      decision,
    });
  } catch (error) {
    return {
      status: "error",
      message: normalizeError(error),
    };
  }
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}


