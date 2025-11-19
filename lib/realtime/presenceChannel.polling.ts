/**
 * Polling-only implementation of presence channel
 * 
 * This is a simplified version that skips Realtime entirely
 * and only uses polling. Useful for:
 * - Testing when Realtime is not available
 * - Environments where WebSockets are blocked
 * - Debugging presence issues
 * 
 * To use this, set the environment variable:
 * NEXT_PUBLIC_DISABLE_REALTIME=true
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PresenceCallbacks,
  PresenceSubscription,
} from "./presenceChannel";

interface PresenceOptions<TPollState extends object> {
  poller?: () => Promise<TPollState[]>;
  pollIntervalMs?: number;
  key?: string;
}

export function subscribeToLobbyPresencePollingOnly<
  TState extends object = Record<string, unknown>
>(
  client: SupabaseClient,
  callbacks: PresenceCallbacks<TState>,
  options: PresenceOptions<TState> = {}
): PresenceSubscription {
  console.log("[PresenceChannel] Using POLLING-ONLY mode (Realtime disabled)");
  
  const pollInterval = options.pollIntervalMs ?? 500;
  let pollHandle: NodeJS.Timeout | null = null;

  // Start polling immediately
  if (options.poller) {
    const poller = async () => {
      try {
        const result = await options.poller!();
        callbacks.onSync?.(result, "poller");
      } catch (error) {
        console.error("[PresenceChannel] Polling error:", error);
        callbacks.onError?.(error);
      }
    };
    
    // Initial poll
    poller();
    
    // Continue polling
    pollHandle = setInterval(poller, pollInterval);
    console.log(`[PresenceChannel] Started polling every ${pollInterval}ms`);
  } else {
    console.warn("[PresenceChannel] No poller provided, presence will not work");
  }

  // Create a mock channel object
  const mockChannel = {
    presenceState: () => ({}),
    track: () => {
      console.log("[PresenceChannel] track() called (no-op in polling mode)");
    },
    untrack: () => {
      console.log("[PresenceChannel] untrack() called (no-op in polling mode)");
    },
    unsubscribe: () => {
      console.log("[PresenceChannel] unsubscribe() called");
      if (pollHandle) {
        clearInterval(pollHandle);
      }
    },
  };

  return {
    channel: mockChannel as any,
    stopPolling() {
      console.log("[PresenceChannel] stopPolling() called");
      if (pollHandle) {
        clearInterval(pollHandle);
      }
    },
    updatePresence(payload) {
      // In polling-only mode, we don't track presence via Realtime
      // The server-side presence records handle this
      console.log("[PresenceChannel] updatePresence() called (no-op in polling mode)");
    },
  };
}

