import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export interface PresenceCallbacks<TState extends object = Record<string, unknown>> {
  onJoin?: (payload: TState) => void;
  onLeave?: (payload: TState) => void;
  onSync?: (payload: TState[], source: "realtime" | "poller") => void;
  onError?: (error: unknown) => void;
}

export interface PresenceSubscription {
  channel: RealtimeChannel;
  stopPolling: () => void;
  updatePresence: (payload: Record<string, unknown>) => void;
}

interface PresenceOptions<TPollState extends object> {
  poller?: () => Promise<TPollState[]>;
  pollIntervalMs?: number;
  key?: string;
}

export function subscribeToLobbyPresence<
  TState extends object = Record<string, unknown>
>(
  client: SupabaseClient,
  callbacks: PresenceCallbacks<TState>,
  options: PresenceOptions<TState> = {}
): PresenceSubscription {
  const channel = client.channel("lobby-presence", {
    config: {
      presence: {
        key: options.key ?? "anonymous",
      },
    },
  });
  let trackedPayload: Record<string, unknown> | null = null;
  let pendingPayload: Record<string, unknown> | null = null;
  let isSubscribed = false;

  function pushPresence(payload: Record<string, unknown>) {
    trackedPayload = payload;
    if (isSubscribed) {
      channel.track(payload);
      pendingPayload = null;
    } else {
      pendingPayload = payload;
    }
  }

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<TState>();
      console.log("[Realtime] Presence sync event:", Object.keys(state).length, "users");
      callbacks.onSync?.(flattenPresence(state), "realtime");
    })
    .on("presence", { event: "join" }, ({ newPresences }) => {
      console.log("[Realtime] Presence join event:", newPresences.length, "users");
      newPresences.forEach((presence) =>
        callbacks.onJoin?.(presence as unknown as TState)
      );
    })
    .on("presence", { event: "leave" }, ({ leftPresences }) => {
      console.log("[Realtime] Presence leave event:", leftPresences.length, "users");
      leftPresences.forEach((presence) =>
        callbacks.onLeave?.(presence as unknown as TState)
      );
    })
    .subscribe((status) => {
      console.log("[Realtime] Channel status changed:", status);
      
      if (status === "SUBSCRIBED") {
        console.log("[Realtime] Successfully subscribed to lobby-presence channel");
        isSubscribed = true;
        if (pendingPayload) {
          console.log("[Realtime] Tracking pending presence payload");
          channel.track(pendingPayload);
          pendingPayload = null;
        } else if (trackedPayload) {
          console.log("[Realtime] Tracking current presence payload");
          channel.track(trackedPayload);
        }
      } else if (status === "CHANNEL_ERROR") {
        console.error("[Realtime] CHANNEL_ERROR - Realtime Presence is not working");
        console.error("[Realtime] This usually means the Realtime service is not properly configured");
        callbacks.onError?.(new Error("Realtime channel error (lobby-presence)"));
      } else if (status === "TIMED_OUT") {
        console.error("[Realtime] TIMED_OUT - Connection never established");
        callbacks.onError?.(new Error("Realtime connection timed out"));
      } else if (status === "CLOSED") {
        console.log("[Realtime] CLOSED - Channel was closed");
      } else {
        console.log("[Realtime] Unknown channel status:", status);
      }
    });

  const pollInterval = options.pollIntervalMs ?? 2_000;
  let pollHandle: NodeJS.Timeout | null = null;

  if (options.poller) {
    const poller = async () => {
      try {
        const result = await options.poller!();
        callbacks.onSync?.(result, "poller");
      } catch (error) {
        callbacks.onError?.(error);
      }
    };
    poller();
    pollHandle = setInterval(poller, pollInterval);
  }

  return {
    channel,
    stopPolling() {
      if (pollHandle) {
        clearInterval(pollHandle);
      }
      channel.unsubscribe();
    },
    updatePresence(payload) {
      const merged =
        trackedPayload === null
          ? payload
          : {
              ...trackedPayload,
              ...payload,
            };
      pushPresence(merged);
    },
  };
}

function flattenPresence<T>(state: Record<string, T[]>): T[] {
  return Object.values(state).flat();
}

