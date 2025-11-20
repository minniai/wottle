import { getServiceRoleClient } from "@/lib/supabase/server";

import { loadMatchState } from "./stateLoader";

export async function publishMatchState(matchId: string) {
  const supabase = getServiceRoleClient();
  const state = await loadMatchState(supabase, matchId);
  if (!state) {
    return;
  }

  const channel = supabase.channel(`match:${matchId}`);
  const result = await channel.send({
    type: "broadcast",
    event: "state",
    payload: state,
  });

  if (result === "error") {
    console.error("[MatchState] Failed to broadcast match snapshot");
  }
}

