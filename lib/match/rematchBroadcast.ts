import type { RematchEvent } from "@/lib/types/match";
import { getServiceRoleClient } from "@/lib/supabase/server";

export async function broadcastRematchEvent(
  matchId: string,
  event: RematchEvent,
): Promise<void> {
  const supabase = getServiceRoleClient();
  const channel = supabase.channel(`match:${matchId}`);

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: "rematch",
            payload: event,
          })
          .then((result) => {
            if (result === "error") {
              console.error(
                "[Rematch] Failed to broadcast rematch event",
              );
            }
            supabase.removeChannel(channel);
            resolve();
          });
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(
          `[Rematch] Channel subscription failed: ${status}`,
        );
        supabase.removeChannel(channel);
        reject(new Error(`Channel subscription failed: ${status}`));
      }
    });
  });
}
