"use client";

import { useEffect, useState } from "react";

export interface CountdownState {
  remaining: number;
  expired: boolean;
}

export function useCountdown(startSeconds: number): CountdownState {
  const [remaining, setRemaining] = useState(startSeconds);

  useEffect(() => {
    setRemaining(startSeconds);
    if (startSeconds <= 0) return;

    const id = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1_000);

    return () => clearInterval(id);
  }, [startSeconds]);

  return { remaining, expired: remaining <= 0 };
}
