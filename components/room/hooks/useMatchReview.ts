"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { stepOfCell } from "@/lib/review/ledgerCells";
import { parseReviewParam } from "@/lib/review/reviewParam";
import type { ReviewStep } from "@/lib/types/review";

import type { ReviewControl } from "../ReviewControls";
import { useReviewAutoplay } from "./useReviewAutoplay";
import { useReviewHistory } from "./useReviewHistory";
import { useReviewMoves } from "./useReviewMoves";

export interface MatchReview {
  /** `?review` is on the URL of a completed match and its steps are loaded. */
  reviewing: boolean;
  steps: ReviewStep[] | null;
  step: ReviewStep | null;
  /** The step before the current one, when the last change moved forward by exactly one. */
  previous: ReviewStep | null;
  playing: boolean;
  enter: () => void;
  leave: () => void;
  go: (index: number) => void;
  control: (control: ReviewControl) => void;
  jump: (slot: "player_a" | "player_b", move: number) => void;
  togglePlay: () => void;
}

/**
 * Spec 071 (US3, US4): review as a state of the match page. The URL is the source of truth: the
 * step is `?review=n`, corrected in place, and dropped from a match that is not over.
 */
export function useMatchReview({ matchId, completed, live }: { matchId: string; completed: boolean; live: boolean }): MatchReview {
  const raw = useSearchParams().get("review");
  const { steps } = useReviewMoves(matchId, completed && raw !== null);
  const parsed = steps ? parseReviewParam(raw, steps.length) : null;
  const history = useReviewHistory();
  const index = parsed?.step ?? null;
  const step = steps && index ? steps[index - 1] : null;

  useEffect(() => {
    if (raw !== null && live) history.drop();
    else if (parsed && parsed.canonical !== raw) history.correct(parsed.canonical);
  }, [raw, live, parsed, history]);

  // Which step came before this one, kept as state so the forward step's motion can be told apart.
  const [track, setTrack] = useState<{ index: number | null; prev: number | null }>({ index, prev: null });
  if (track.index !== index) setTrack({ index, prev: track.index });
  const previous = step && steps && track.prev === step.index - 1 ? steps[step.index - 2] : null;

  const stepTo = history.stepTo;
  const autoplay = useReviewAutoplay({ step: index ?? 1, stepCount: steps?.length ?? 1, onStep: stepTo });
  const stopThen = useCallback((n: number) => {
    autoplay.stop();
    stepTo(n);
  }, [autoplay, stepTo]);

  const control = useCallback((c: ReviewControl) => {
    if (c === "play") return autoplay.toggle();
    const total = steps?.length ?? 1;
    const now = index ?? 1;
    const target = { first: 1, back: Math.max(1, now - 1), next: Math.min(total, now + 1), last: total }[c];
    stopThen(target);
  }, [autoplay, steps, index, stopThen]);

  const jump = useCallback((slot: "player_a" | "player_b", move: number) => {
    const target = steps ? stepOfCell(steps, slot, move) : null;
    if (target) stopThen(target);
  }, [steps, stopThen]);

  return {
    reviewing: completed && raw !== null && step !== null,
    steps,
    step,
    previous,
    playing: autoplay.playing,
    enter: () => history.enter("last"),
    leave: () => {
      autoplay.stop();
      history.leave();
    },
    go: stopThen,
    control,
    jump,
    togglePlay: autoplay.toggle,
  };
}
