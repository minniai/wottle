"use client";

import { useEffect, useRef, useState } from "react";

import { COUNT_UP_MS } from "@/lib/room/revealSequence";

/** Displayed number eases from the previous value to `target` over 400 ms (0 ms under reduced motion). */
export function useCountUp(target: number, reducedMotion: boolean, durationMs = COUNT_UP_MS): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (reducedMotion || from === target || typeof requestAnimationFrame === "undefined") {
      fromRef.current = target;
      setShown(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion, durationMs]);
  return shown;
}
