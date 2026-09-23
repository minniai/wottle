"use client";

import { useCallback, useEffect, useRef } from "react";

import type { Attention } from "@/lib/matchmaking/attention";

const INPUT_EVENTS = ["pointerdown", "keydown"] as const;

/**
 * The tab's attention (spec 069 R5): whether it is visible, and how long since
 * the player last pressed or typed. Arriving on the page counts as input: a
 * player got here by using it. Returns a reader, so the room never re-renders
 * on input; the polls read it when they ask.
 */
export function useAttention(): () => Attention {
  const lastInput = useRef(Date.now());
  useEffect(() => {
    const mark = () => {
      lastInput.current = Date.now();
    };
    for (const type of INPUT_EVENTS) window.addEventListener(type, mark, { passive: true });
    return () => {
      for (const type of INPUT_EVENTS) window.removeEventListener(type, mark);
    };
  }, []);
  return useCallback(() => ({ visible: document.visibilityState !== "hidden", inputAgoMs: Date.now() - lastInput.current }), []);
}
