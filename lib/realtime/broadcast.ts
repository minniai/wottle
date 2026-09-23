"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Listens on a broadcast topic for pokes (spec 070 FR-034): the event name and
 * a payload that carries at most a timing. `onJoined` reports whether the
 * channel is live, so callers can slow their fallback poll. With Realtime
 * disabled nothing is joined and the polls carry everything.
 */
export function subscribeBroadcast(
  topic: string,
  onEvent: (event: string, payload: Record<string, unknown>) => void,
  onJoined: (joined: boolean) => void,
): () => void {
  if (process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true") {
    onJoined(false);
    return () => undefined;
  }
  const client = getBrowserSupabaseClient();
  const channel = client
    .channel(topic)
    .on("broadcast", { event: "*" }, (message: { event: string; payload?: Record<string, unknown> }) => onEvent(message.event, message.payload ?? {}))
    .subscribe((status) => onJoined(status === "SUBSCRIBED"));
  return () => {
    onJoined(false);
    void client.removeChannel(channel);
  };
}
