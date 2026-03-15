import { getServiceRoleClient } from "@/lib/supabase/server";

import { loadMatchState } from "./stateLoader";

export async function publishMatchState(matchId: string) {
  const supabase = getServiceRoleClient();
  const state = await loadMatchState(supabase, matchId);
  if (!state) {
    return;
  }

  const channel = supabase.channel(`match:${matchId}`);

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: "state",
            payload: state,
          })
          .then((result) => {
            if (result === "error") {
              console.error(
                "[MatchState] Failed to broadcast match snapshot",
              );
            }
            supabase.removeChannel(channel);
            resolve();
          });
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(
          `[MatchState] Channel subscription failed: ${status}`,
        );
        supabase.removeChannel(channel);
        resolve();
      }
    });
  });
}

