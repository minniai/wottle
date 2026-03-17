"use client";

import { useCallback } from "react";

// Haptic patterns from research.md § Decision 5
const PATTERN_VALID_SWAP: number[] = [15];
const PATTERN_INVALID_MOVE: number[] = [30, 50, 30];
const PATTERN_MATCH_START: number[] = [100];
const PATTERN_MATCH_END: number[] = [50, 30, 50];

function vibrate(pattern: number[]): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

export interface HapticFeedback {
  vibrateValidSwap: () => void;
  vibrateInvalidMove: () => void;
  vibrateMatchStart: () => void;
  vibrateMatchEnd: () => void;
}

export function useHapticFeedback(enabled: boolean): HapticFeedback {
  const vibrateValidSwap = useCallback(() => {
    if (!enabled) return;
    vibrate(PATTERN_VALID_SWAP);
  }, [enabled]);

  const vibrateInvalidMove = useCallback(() => {
    if (!enabled) return;
    vibrate(PATTERN_INVALID_MOVE);
  }, [enabled]);

  const vibrateMatchStart = useCallback(() => {
    if (!enabled) return;
    vibrate(PATTERN_MATCH_START);
  }, [enabled]);

  const vibrateMatchEnd = useCallback(() => {
    if (!enabled) return;
    vibrate(PATTERN_MATCH_END);
  }, [enabled]);

  return { vibrateValidSwap, vibrateInvalidMove, vibrateMatchStart, vibrateMatchEnd };
}
