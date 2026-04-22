import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type {
  MatchState,
  RematchEvent,
  RoundSummary,
} from "@/lib/types/match";

export interface MatchPresencePayload {
  playerId: string;
}

export interface MatchChannelCallbacks {
  onState?: (snapshot: MatchState) => void;
  onSummary?: (summary: RoundSummary) => void;
  onRematchEvent?: (event: RematchEvent) => void;
  onError?: (error: unknown) => void;
  /**
   * Fires when a *different* player's presence drops from the match channel.
   * Supabase emits a presence "leave" event when a peer's WebSocket closes
   * for any reason (tab close, crash, network drop). Self-leaves are filtered
   * out so consumers only see opponent disconnects.
   *
   * Only invoked when `presenceKey` is set on the subscription, and only when
   * the channel actually reaches SUBSCRIBED — which is not guaranteed in every
   * environment, so this should be treated as a best-effort signal alongside
   * the sendBeacon + polling fallback.
   */
  onOpponentLeave?: (presence: MatchPresencePayload) => void;
}

export interface MatchChannelOptions extends MatchChannelCallbacks {
  /**
   * If provided, the channel joins Supabase presence under this key (typically
   * the local player's id). Required for `onOpponentLeave` to fire.
   */
  presenceKey?: string;
}

export function subscribeToMatchChannel(
  client: SupabaseClient,
  matchId: string,
  options: MatchChannelOptions
): RealtimeChannel {
  const { presenceKey, ...callbacks } = options;
  const channel = presenceKey
    ? client.channel(`match:${matchId}`, {
        config: { presence: { key: presenceKey } },
      })
    : client.channel(`match:${matchId}`);

  channel
    .on("broadcast", { event: "state" }, (payload) => {
      callbacks.onState?.(payload.payload as MatchState);
    })
    .on("broadcast", { event: "round-summary" }, (payload) => {
      callbacks.onSummary?.(payload.payload as RoundSummary);
    })
    .on("broadcast", { event: "rematch" }, (payload) => {
      callbacks.onRematchEvent?.(payload.payload as RematchEvent);
    });

  if (presenceKey) {
    channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      for (const presence of leftPresences) {
        const playerId = (presence as { playerId?: unknown })?.playerId;
        if (typeof playerId === "string" && playerId !== presenceKey) {
          callbacks.onOpponentLeave?.({ playerId });
        }
      }
    });
  }

  channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR") {
      callbacks.onError?.(new Error(`Realtime channel error (match:${matchId})`));
      return;
    }
    if (status === "SUBSCRIBED" && presenceKey) {
      void channel.track({ playerId: presenceKey });
    }
  });

  return channel;
}
