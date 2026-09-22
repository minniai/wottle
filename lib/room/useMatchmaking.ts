"use client";

import type { Language } from "@/lib/types/game-config";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import type { PlayerIdentity } from "@/lib/types/match";

export const QUEUE_POLL_MS = 3_000;

export type MatchmakingState =
  | { kind: "searching"; elapsedSeconds: number }
  | { kind: "found"; matchId: string; opponent: PlayerIdentity | null }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

export interface MatchmakingApi {
  state: MatchmakingState;
  cancel: () => Promise<void>;
}

/**
 * Ranked queue (ported from MatchmakingClient): `startQueueAction` is polled
 * every 3 s until `matched`; the opponent's identity comes from
 * `getMatchOverviewAction`. Pure state — rendering is the room's job.
 */
/** `language` is the lobby's game language (spec 060): the queue pairs only within it. */
export function useMatchmaking(enabled: boolean, startedAt = Date.now(), language: Language = "is"): MatchmakingApi {
  const [state, setState] = useState<MatchmakingState>({ kind: "searching", elapsedSeconds: 0 });
  const stopped = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;
    const tick = setInterval(() => {
      setState((prev) => (prev.kind === "searching" ? { kind: "searching", elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) } : prev));
    }, 1_000);
    return () => clearInterval(tick);
  }, [enabled, startedAt]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const poll = async () => {
      if (stopped.current) return;
      const result = await startQueueAction({ language }).catch((e: Error) => ({ status: "error" as const, message: e.message }));
      if (!active || stopped.current) return;
      if (result.status === "matched" && result.matchId) {
        stopped.current = true;
        const overview = await getMatchOverviewAction({ matchId: result.matchId }).catch(() => null);
        if (!active) return;
        setState({ kind: "found", matchId: result.matchId, opponent: overview && overview.status === "ok" ? overview.opponent : null });
      } else if (result.status === "error" || result.status === "unauthenticated") {
        setState({ kind: "error", message: "message" in result && result.message ? result.message : result.status });
      }
    };
    void poll();
    const id = setInterval(poll, QUEUE_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, language]);

  const cancel = useCallback(async () => {
    stopped.current = true;
    setState({ kind: "cancelled" });
    await cancelQueueAction().catch(() => undefined);
  }, []);

  return { state, cancel };
}
