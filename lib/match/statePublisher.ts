import { getServiceRoleClient } from "@/lib/supabase/server";

import { loadMatchState } from "./stateLoader";

/**
 * Max time we'll wait for channel.subscribe() to reach SUBSCRIBED before
 * giving up and resolving. Supabase's internal default is ~10s, which in
 * local dev (and occasionally in prod) stalls the round-advancement pipeline
 * because roundEngine awaits this broadcast. Callers should treat broadcast
 * delivery as best-effort — clients recover via the 2s safety poll.
 */
const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 2_000;

export async function publishMatchState(matchId: string) {
  const supabase = getServiceRoleClient();
  const state = await loadMatchState(supabase, matchId);
  if (!state) {
    return;
  }

  const channel = supabase.channel(`match:${matchId}`);
  let settled = false;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error(
        `[MatchState] Channel subscribe timed out after ${BROADCAST_SUBSCRIBE_TIMEOUT_MS}ms; giving up on broadcast`,
      );
      supabase.removeChannel(channel);
      resolve();
    }, BROADCAST_SUBSCRIBE_TIMEOUT_MS);

    channel.subscribe((status) => {
      if (settled) return;

      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: "state",
            payload: state,
          })
          .then((result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (result === "error") {
              console.error(
                "[MatchState] Failed to broadcast match snapshot",
              );
            }
            supabase.removeChannel(channel);
            resolve();
          });
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        settled = true;
        clearTimeout(timer);
        console.error(
          `[MatchState] Channel subscription failed: ${status}`,
        );
        supabase.removeChannel(channel);
        resolve();
      }
    });
  });
}
