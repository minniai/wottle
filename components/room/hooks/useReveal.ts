"use client";

import { useEffect, useRef, useState } from "react";

import { applyStep, planReveal, REVEAL_DONE, REVEAL_START, type RevealProgress, type RevealStep } from "@/lib/room/revealSequence";

export interface RevealInput {
  /** Changes when a new reveal should start (round number or partial key); null = nothing to reveal. */
  key: string | null;
  /** Band ids of the words in this reveal, in reading order. */
  wordIds: string[];
  alreadyDrawn: Set<string>;
  reducedMotion: boolean;
  onBand?: (wordIndex: number) => void;
}

export interface RevealState extends RevealProgress {
  /** Ids the running (or last completed) plan actually drew; empty for settle-only plans. */
  planIds: string[];
  /**
   * The key this progress belongs to. A new key does not reach the state until
   * the planning effect runs, so `settled` reads stale-true for a render or two
   * after one arrives; a caller that acts on settling must check this first.
   */
  planKey: string | null;
}

const DONE: RevealState = { ...REVEAL_DONE, planIds: [], planKey: null };

/**
 * Schedules a reveal plan and exposes its progress. Re-keying cancels the
 * running plan; plans with nothing to draw complete synchronously so a
 * re-plan after settling never flickers back to "revealing".
 */
export function useReveal(input: RevealInput): RevealState {
  const [state, setState] = useState<RevealState>(DONE);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onBandRef = useRef(input.onBand);
  useEffect(() => {
    onBandRef.current = input.onBand;
  }, [input.onBand]);

  const { key, reducedMotion } = input;
  const idsKey = input.wordIds.join("|");
  const drawnKey = [...input.alreadyDrawn].sort().join("|");

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!key) {
      setState(DONE);
      return;
    }
    const ids = idsKey ? idsKey.split("|") : [];
    const drawn = new Set(drawnKey ? drawnKey.split("|") : []);
    const steps: RevealStep[] = planReveal(ids, { reducedMotion, alreadyDrawn: drawn });
    const planIds = ids.filter((id) => !drawn.has(id));
    if (steps.length === 1 && steps[0].kind === "settle" && steps[0].at === 0) {
      setState({ ...REVEAL_DONE, planIds: reducedMotion ? planIds : [], planKey: key });
      return;
    }
    setState({ ...REVEAL_START, planIds, planKey: key });
    timers.current = steps.map((step) =>
      setTimeout(() => {
        if (step.kind === "band") onBandRef.current?.(step.wordIndex ?? 0);
        setState((prev) => ({ ...applyStep(prev, step), planIds: prev.planIds, planKey: prev.planKey }));
      }, step.at),
    );
    return () => timers.current.forEach(clearTimeout);
  }, [key, idsKey, drawnKey, reducedMotion]);

  return state;
}
