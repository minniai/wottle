"use client";

import { useEffect, useState } from "react";

export interface CountdownState {
  remaining: number;
  expired: boolean;
}

interface State {
  start: number;
  remaining: number;
}

export function useCountdown(startSeconds: number): CountdownState {
  const [state, setState] = useState<State>({
    start: startSeconds,
    remaining: startSeconds,
  });

  // Derived-state reset: when the prop changes, React calls setState during
  // render, bails the current render, and restarts with the new state.
  // See https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (state.start !== startSeconds) {
    setState({ start: startSeconds, remaining: startSeconds });
  }

  useEffect(() => {
    if (state.remaining <= 0) return;
    const id = setInterval(() => {
      setState((prev) => ({
        ...prev,
        remaining: prev.remaining > 0 ? prev.remaining - 1 : 0,
      }));
    }, 1_000);
    return () => clearInterval(id);
  }, [state.remaining]);

  return { remaining: state.remaining, expired: state.remaining <= 0 };
}
