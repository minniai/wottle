import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type {
  MatchState,
  RematchEvent,
  RoundSummary,
} from "@/lib/types/match";

export interface MatchChannelCallbacks {
  onState?: (snapshot: MatchState) => void;
  onSummary?: (summary: RoundSummary) => void;
  onRematchEvent?: (event: RematchEvent) => void;
  onError?: (error: unknown) => void;
}

export function subscribeToMatchChannel(
  client: SupabaseClient,
  matchId: string,
  callbacks: MatchChannelCallbacks
): RealtimeChannel {
  const channel = client.channel(`match:${matchId}`);

  channel
    .on("broadcast", { event: "state" }, (payload) => {
      callbacks.onState?.(payload.payload as MatchState);
    })
    .on("broadcast", { event: "round-summary" }, (payload) => {
      callbacks.onSummary?.(payload.payload as RoundSummary);
    })
    .on("broadcast", { event: "rematch" }, (payload) => {
      callbacks.onRematchEvent?.(payload.payload as RematchEvent);
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        callbacks.onError?.(new Error(`Realtime channel error (match:${matchId})`));
      }
    });

  return channel;
}
