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

// Reconnect back-off schedule: 5s → 10s → 20s → 40s, then cap at 60s.
// Intentionally gentle so a persistently broken Realtime service doesn't
// hammer Supabase while the polling fallback carries the UI.
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_CAP_MS = 60_000;

export function subscribeToLobbyPresence<
  TState extends object = Record<string, unknown>
>(
  client: SupabaseClient,
  callbacks: PresenceCallbacks<TState>,
  options: PresenceOptions<TState> = {}
): PresenceSubscription {
  let trackedPayload: Record<string, unknown> | null = null;
  let pendingPayload: Record<string, unknown> | null = null;
  let isSubscribed = false;
  let stopped = false;
  // Definite-assignment assertion — `attemptSubscribe()` runs synchronously
  // before the function returns, so `channel` is always set by then.
  let channel!: RealtimeChannel;

  function pushPresence(payload: Record<string, unknown>) {
    trackedPayload = payload;
    if (isSubscribed) {
      channel.track(payload);
      pendingPayload = null;
    } else {
      pendingPayload = payload;
    }
  }

  // Polling fallback — starts only while Realtime is unavailable. Running
  // the poller unconditionally corrupts `connectionMode` in the store:
  // `onSync(_, "poller")` would fire every `pollIntervalMs` and overwrite
  // the "realtime" flag set by the (rarer) presence sync events, leaving
  // the UI stuck on "Polling" even when Realtime is fully functional.
  const pollInterval = options.pollIntervalMs ?? 2_000;
  let pollHandle: NodeJS.Timeout | null = null;

  const startPollingFallback = () => {
    if (!options.poller || pollHandle) {
      return;
    }
    console.log("[Realtime] Starting polling fallback (Realtime unavailable)");
    const tick = async () => {
      try {
        const result = await options.poller!();
        callbacks.onSync?.(result, "poller");
      } catch (error) {
        callbacks.onError?.(error);
      }
    };
    void tick();
    pollHandle = setInterval(tick, pollInterval);
  };

  const stopPollingFallback = () => {
    if (pollHandle) {
      console.log("[Realtime] Stopping polling fallback (Realtime recovered)");
      clearInterval(pollHandle);
      pollHandle = null;
    }
  };

  // Reconnect loop — runs in parallel with the polling fallback. Keeps
  // trying to re-establish the WebSocket with exponential back-off until
  // it succeeds or the subscription is torn down.
  let reconnectAttempt = 0;
  let reconnectHandle: NodeJS.Timeout | null = null;

  const scheduleReconnect = () => {
    if (stopped || reconnectHandle) {
      return;
    }
    const backoffMs = Math.min(
      RECONNECT_CAP_MS,
      RECONNECT_BASE_MS * 2 ** reconnectAttempt
    );
    reconnectAttempt += 1;
    console.log(
      `[Realtime] Scheduling reconnect attempt #${reconnectAttempt} in ${backoffMs}ms`
    );
    reconnectHandle = setTimeout(() => {
      reconnectHandle = null;
      attemptSubscribe();
    }, backoffMs);
  };

  const attemptSubscribe = () => {
    if (stopped) {
      return;
    }
    isSubscribed = false;
    // Remove any prior channel so the next `client.channel("lobby-presence")`
    // call returns a fresh instance (the client caches channels by topic).
    if (channel) {
      try {
        void client.removeChannel(channel);
      } catch (error) {
        console.warn("[Realtime] Failed to remove stale channel:", error);
      }
    }
    channel = client.channel("lobby-presence", {
      config: {
        presence: {
          key: options.key ?? "anonymous",
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<TState>();
        console.log(
          "[Realtime] Presence sync event:",
          Object.keys(state).length,
          "users"
        );
        callbacks.onSync?.(flattenPresence(state), "realtime");
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("[Realtime] Presence join event:", newPresences.length, "users");
        newPresences.forEach((presence) =>
          callbacks.onJoin?.(presence as unknown as TState)
        );
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log(
          "[Realtime] Presence leave event:",
          leftPresences.length,
          "users"
        );
        leftPresences.forEach((presence) =>
          callbacks.onLeave?.(presence as unknown as TState)
        );
      })
      .subscribe((status) => {
        console.log("[Realtime] Channel status changed:", status);

        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Successfully subscribed to lobby-presence channel");
          isSubscribed = true;
          reconnectAttempt = 0;
          stopPollingFallback();
          if (pendingPayload) {
            console.log("[Realtime] Tracking pending presence payload");
            channel.track(pendingPayload);
            pendingPayload = null;
          } else if (trackedPayload) {
            console.log("[Realtime] Re-tracking presence after reconnect");
            channel.track(trackedPayload);
          }
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] CHANNEL_ERROR - Realtime Presence is not working");
          console.error(
            "[Realtime] This usually means the Realtime service is not properly configured"
          );
          callbacks.onError?.(new Error("Realtime channel error (lobby-presence)"));
          startPollingFallback();
          scheduleReconnect();
        } else if (status === "TIMED_OUT") {
          console.error("[Realtime] TIMED_OUT - Connection never established");
          callbacks.onError?.(new Error("Realtime connection timed out"));
          startPollingFallback();
          scheduleReconnect();
        } else if (status === "CLOSED") {
          console.log("[Realtime] CLOSED - Channel was closed");
        } else {
          console.log("[Realtime] Unknown channel status:", status);
        }
      });
  };

  attemptSubscribe();

  return {
    get channel() {
      return channel;
    },
    stopPolling() {
      stopped = true;
      stopPollingFallback();
      if (reconnectHandle) {
        clearTimeout(reconnectHandle);
        reconnectHandle = null;
      }
      if (channel) {
        try {
          void client.removeChannel(channel);
        } catch (error) {
          console.warn("[Realtime] Failed to remove channel on teardown:", error);
        }
      }
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

