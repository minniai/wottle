"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { attentionQuery, type Attention } from "@/lib/matchmaking/attention";
import { POLL_FALLBACK_MS, POLL_LIVE_MS } from "@/lib/presence/constants";
import { subscribeBroadcast } from "@/lib/realtime/broadcast";
import { standingFactsSchema, type StandingFacts } from "@/lib/types/standing";

export type PokeListener = (kind: string) => void;

export interface StandingFactsApi {
  facts: StandingFacts | null;
  /** The player channel is joined: the fallback poll has slowed to 12s. */
  joined: boolean;
  refresh: () => void;
  /** Hear every poke on the player's topic (US9: a rematch re-reads its own route). */
  onPoke: (listener: PokeListener) => () => void;
}

/**
 * The viewer's standing (spec 070 R5, R6, FR-034, FR-035): read from
 * /api/standing with the tab's attention, again on every poke on the viewer's
 * own topic, and on a fallback poll, 3s without the channel and 12s with it.
 * Nothing here navigates on what a broadcast carries.
 */
export function useStandingFacts(attention: () => Attention): StandingFactsApi {
  const [facts, setFacts] = useState<StandingFacts | null>(null);
  const [joined, setJoined] = useState(false);
  const listeners = useRef(new Set<PokeListener>());
  const alive = useRef(true);

  const read = useCallback(async () => {
    const response = await fetch(`/api/standing?${attentionQuery(attention())}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok || !alive.current) return;
    const parsed = standingFactsSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success && alive.current) setFacts(parsed.data);
  }, [attention]);

  useEffect(() => {
    alive.current = true;
    void read();
    return () => {
      alive.current = false;
    };
  }, [read]);

  const topic = facts?.topic ?? null;
  useEffect(() => {
    if (!topic) return;
    return subscribeBroadcast(
      topic,
      (event) => {
        void read();
        listeners.current.forEach((l) => l(event));
      },
      setJoined,
    );
  }, [topic, read]);

  useEffect(() => {
    const id = setInterval(() => void read(), joined ? POLL_LIVE_MS : POLL_FALLBACK_MS);
    return () => clearInterval(id);
  }, [joined, read]);

  const onPoke = useCallback((listener: PokeListener) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);

  return { facts, joined, refresh: () => void read(), onPoke };
}
