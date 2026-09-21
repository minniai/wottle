import { getServiceRoleClient } from "@/lib/supabase/server";
import type { MoveResolution } from "@/lib/types/match";

/**
 * Broadcast one `move-resolved` event on the match channel (spec 050,
 * contracts/move-resolved-event.md). Best effort, as the state broadcast:
 * clients converge from the 2s safety poll on `resolvedSeq`.
 */
const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 2_000;

export async function publishMoveResolved(resolution: MoveResolution): Promise<void> {
  const supabase = getServiceRoleClient();
  const channel = supabase.channel(`match:${resolution.matchId}`);
  let settled = false;

  await new Promise<void>((resolve) => {
    const finish = (message?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (message) console.error(`[MoveResolved] ${message}`);
      supabase.removeChannel(channel);
      resolve();
    };
    const timer = setTimeout(
      () => finish(`channel subscribe timed out after ${BROADCAST_SUBSCRIBE_TIMEOUT_MS}ms; giving up`),
      BROADCAST_SUBSCRIBE_TIMEOUT_MS,
    );
    channel.subscribe((status) => {
      if (settled) return;
      if (status === "SUBSCRIBED") {
        channel
          .send({ type: "broadcast", event: "move-resolved", payload: resolution })
          .then((result) => finish(result === "error" ? "failed to broadcast the resolution" : undefined));
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") finish(`channel subscription failed: ${status}`);
    });
  });
}
