"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import {
  respondToInvite,
  sendDirectInvite,
  type RespondInviteResult,
  type SendDirectInviteResult,
} from "@/lib/matchmaking/inviteService";
import { getServiceRoleClient } from "@/lib/supabase/server";

const DEFAULT_INVITE_TTL_SECONDS = Number(
  process.env.PLAYTEST_INVITE_EXPIRY_SECONDS ?? "30"
);

export interface InviteActionState extends SendDirectInviteResult {
  status: "sent" | "error" | "unauthenticated";
  message?: string;
}

export interface InviteDecisionState {
  status: RespondInviteResult["status"] | "error" | "unauthenticated";
  matchId?: string;
  message?: string;
}

export async function sendInviteAction(
  recipientId: string
): Promise<InviteActionState> {
  if (!recipientId) {
    return { status: "error", inviteId: "", expiresAt: "", message: "Recipient is required." };
  }

  const session = await readLobbySession();
  if (!session) {
    return {
      status: "unauthenticated",
      inviteId: "",
      expiresAt: "",
      message: "Log in to send invites.",
    };
  }

  try {
    const supabase = getServiceRoleClient();
    const result = await sendDirectInvite(supabase, {
      senderId: session.player.id,
      recipientId,
      ttlSeconds: DEFAULT_INVITE_TTL_SECONDS,
    });
    return {
      status: "sent",
      ...result,
    };
  } catch (error) {
    return {
      status: "error",
      inviteId: "",
      expiresAt: "",
      message: normalizeError(error),
    };
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
    const result = await respondToInvite(supabase, {
      inviteId,
      actorId: session.player.id,
      decision,
    });
    return {
      status: result.status,
      matchId: result.matchId,
    };
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


