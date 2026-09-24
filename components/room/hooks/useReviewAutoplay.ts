"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** One step a second (game flow D3). Time, not motion: it runs under reduced motion too. */
export const AUTOPLAY_STEP_MS = 1_000;

interface AutoplayInput {
  step: number;
  stepCount: number;
  onStep: (step: number) => void;
}

/**
 * Spec 071 (FR-035, R16): review plays itself one step a second and stops at the last step, on
 * `stop()` (any other input), or when the tab hides. Played at the last step, it starts over.
 */
export function useReviewAutoplay({ step, stepCount, onStep }: AutoplayInput): { playing: boolean; toggle: () => void; stop: () => void } {
  const [playing, setPlaying] = useState(false);
  const latest = useRef({ step, stepCount, onStep });
  useEffect(() => {
    latest.current = { step, stepCount, onStep };
  }, [step, stepCount, onStep]);

  const stop = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    setPlaying((on) => {
      if (!on && latest.current.step >= latest.current.stepCount) latest.current.onStep(1);
      return !on;
    });
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const { step: now, stepCount: total, onStep: go } = latest.current;
      if (now >= total) return setPlaying(false);
      go(now + 1);
    }, AUTOPLAY_STEP_MS);
    const onHide = () => document.hidden && setPlaying(false);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [playing]);

  return { playing, toggle, stop };
}
