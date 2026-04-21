"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface CancelQueueActionState {
  status: "cancelled" | "in_match" | "unauthenticated" | "error";
  message?: string;
}

export async function cancelQueueAction(): Promise<CancelQueueActionState> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated", message: "Log in to cancel matchmaking." };
  }

  try {
    const supabase = getServiceRoleClient();
    const { data } = await supabase
      .from("players")
      .select("status")
      .eq("id", session.player.id)
      .single();

    if (data?.status === "in_match") {
      return { status: "in_match" };
    }

    await supabase
      .from("players")
      .update({
        status: "available",
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", session.player.id)
      .in("status", ["matchmaking", "available"]);

    return { status: "cancelled" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Cancel failed.",
    };
  }
}
