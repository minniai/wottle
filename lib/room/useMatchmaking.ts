"use client";

import type { Language } from "@/lib/types/game-config";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { useAttention } from "@/components/room/hooks/useAttention";
import type { PlayerIdentity } from "@/lib/types/match";

import { queueView } from "./queueView";

export const QUEUE_POLL_MS = 3_000;
const TICK_MS = 1_000;
const PAUSE_BEACON = "/api/matchmaking/pause";

export type MatchmakingState =
  | { kind: "searching"; elapsedSeconds: number }
  /** Spec 069 FR-021: the tab went hidden; the search waits for `resume ▸`. */
  | { kind: "paused" }
  /** Spec 069 FR-022: 3:00 in, with a 30s drain. */
  | { kind: "stillSearching"; elapsedSeconds: number; drain: number }
  /** The check went unanswered: the search was left. */
  | { kind: "stopped" }
  /** Spec 069 FR-024: two table leaves in 10 minutes. */
  | { kind: "cooldown"; leftMs: number }
  | { kind: "found"; matchId: string; opponent: PlayerIdentity | null }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

export interface MatchmakingApi {
  state: MatchmakingState;
  cancel: () => Promise<void>;
  /** `resume ▸` after a pause. */
  resume: () => void;
  /** `keep searching ▸` at the 3:00 check. */
  keepSearching: () => void;
}

type Outcome = Extract<MatchmakingState, { kind: "found" | "cancelled" | "error" }>;

interface Facts {
  queuedAtMs: number;
  paused: boolean;
  checkAnsweredAtMs: number | null;
  cooldownUntilMs: number | null;
}

/** Ticks once a second while `active`: the queue's lines count, the check drains. */
function useSecond(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** A hidden tab pauses the search on every device (spec 069 FR-021): a beacon, then no more asking. */
function usePauseWhenHidden(active: boolean, pause: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onChange = () => {
      if (document.visibilityState !== "hidden") return;
      navigator.sendBeacon?.(PAUSE_BEACON);
      pause();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [active, pause]);
}

function toState(facts: Facts, nowMs: number, outcome: Outcome | null): MatchmakingState {
  if (outcome) return outcome;
  const view = queueView({ ...facts, nowMs });
  switch (view.kind) {
    case "searching":
      return { kind: "searching", elapsedSeconds: Math.floor(view.elapsedMs / 1000) };
    case "stillSearching":
      return { kind: "stillSearching", elapsedSeconds: Math.floor(view.elapsedMs / 1000), drain: view.drain };
    default:
      return view;
  }
}

/**
 * The queue (spec 044 US8, spec 069 US4): `startQueueAction` is asked every 3s,
 * with the tab's attention, until `matched`. A hidden tab pauses the search;
 * 3:00 in it asks whether to keep searching and leaves the queue if nobody
 * answers; the table-leave cooldown stops it. Pure state: rendering is the room's.
 */
/** `language` is the lobby's game language (spec 060): the queue pairs only within it. */
export function useMatchmaking(enabled: boolean, startedAt = Date.now(), language: Language = "is"): MatchmakingApi {
  const [facts, setFacts] = useState<Facts>({ queuedAtMs: startedAt, paused: false, checkAnsweredAtMs: null, cooldownUntilMs: null });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const attention = useAttention();
  const now = useSecond(enabled && outcome === null);
  const state = toState(facts, now, outcome);
  const asking = enabled && (state.kind === "searching" || state.kind === "stillSearching");

  const pause = useCallback(() => setFacts((f) => ({ ...f, paused: true })), []);
  usePauseWhenHidden(enabled && outcome === null, pause);

  const handleResult = useCallback(
    async (result: Awaited<ReturnType<typeof startQueueAction>>) => {
      if (result.status === "matched" && result.matchId) {
        const overview = await getMatchOverviewAction({ matchId: result.matchId }).catch(() => null);
        setOutcome({ kind: "found", matchId: result.matchId, opponent: overview && overview.status === "ok" ? overview.opponent : null });
      } else if (result.status === "cooldown" && result.until) {
        setFacts((f) => ({ ...f, cooldownUntilMs: Date.parse(result.until!) }));
      } else if (result.status === "paused") {
        pause();
      } else if (result.status === "queued" && result.queuedAt) {
        setFacts((f) => ({ ...f, queuedAtMs: Date.parse(result.queuedAt!) }));
      } else if (result.status === "error" || result.status === "unauthenticated") {
        setOutcome({ kind: "error", message: result.message ?? result.status });
      }
    },
    [pause],
  );

  // The first ask of a search, and the first after `resume ▸`, clears a pause on the server (FR-021).
  const resumeNext = useRef(true);
  useEffect(() => {
    if (!asking) return;
    let active = true;
    const ask = async () => {
      const resume = resumeNext.current;
      resumeNext.current = false;
      const result = await startQueueAction({ language, attention: attention(), ...(resume ? { resume } : {}) }).catch((e: Error) => ({ status: "error" as const, message: e.message }));
      // A poll sent before the tab went hidden may land after the pause beacon and clear it: pause again.
      if (document.visibilityState === "hidden") navigator.sendBeacon?.(PAUSE_BEACON);
      if (active) await handleResult(result);
    };
    void ask();
    const id = setInterval(ask, QUEUE_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [asking, language, attention, handleResult]);

  // An unanswered check leaves the queue, once (FR-022).
  const stopped = enabled && state.kind === "stopped";
  useEffect(() => {
    if (stopped) void cancelQueueAction().catch(() => undefined);
  }, [stopped]);

  const cancel = useCallback(async () => {
    setOutcome({ kind: "cancelled" });
    await cancelQueueAction().catch(() => undefined);
  }, []);
  const resume = useCallback(() => {
    resumeNext.current = true;
    setFacts((f) => ({ ...f, paused: false }));
  }, []);
  const keepSearching = useCallback(() => setFacts((f) => ({ ...f, checkAnsweredAtMs: Date.now() })), []);

  return { state, cancel, resume, keepSearching };
}
