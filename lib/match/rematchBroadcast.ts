import type { RematchEvent } from "@/lib/types/match";
import { getServiceRoleClient } from "@/lib/supabase/server";

export async function broadcastRematchEvent(
  matchId: string,
  event: RematchEvent,
): Promise<void> {
  const supabase = getServiceRoleClient();
  const channel = supabase.channel(`match:${matchId}`);
  const result = await channel.send({
    type: "broadcast",
    event: "rematch",
    payload: event,
  });

  if (result === "error") {
    console.error("[Rematch] Failed to broadcast rematch event");
  }
}
