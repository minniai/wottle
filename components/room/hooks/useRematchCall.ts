"use client";

import { useEffect, useRef, type RefObject } from "react";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { useFavicon } from "@/components/standing/hooks/useFavicon";

interface Feedback {
  sound: { playChallenge: () => void };
}

/**
 * Spec 071 (FR-014): an incoming rematch calls like a challenge. The `challenge` cue plays once
 * when it arrives and the favicon's letter takes the opponent's colour while it waits.
 */
export function useRematchCall(incoming: boolean, feedback: RefObject<Feedback>): void {
  const { id } = useLocale();
  useFavicon(id, incoming);
  const was = useRef(false);
  useEffect(() => {
    if (incoming && !was.current) feedback.current?.sound.playChallenge();
    was.current = incoming;
  }, [incoming, feedback]);
}
