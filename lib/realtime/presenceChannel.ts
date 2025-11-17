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

  function pushPresence(payload: Record<string, unknown>) {
    trackedPayload = payload;
    channel.track(payload);
  }

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<TState>();
      callbacks.onSync?.(flattenPresence(state), "realtime");
    })
    .on("presence", { event: "join" }, ({ newPresences }) => {
      newPresences.forEach((presence) =>
        callbacks.onJoin?.(presence as unknown as TState)
      );
    })
    .on("presence", { event: "leave" }, ({ leftPresences }) => {
      leftPresences.forEach((presence) =>
        callbacks.onLeave?.(presence as unknown as TState)
      );
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        callbacks.onError?.(new Error("Realtime channel error (lobby-presence)"));
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

