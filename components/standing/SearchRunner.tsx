"use client";

import { useEffect, useRef } from "react";

import { useMatchmaking, type MatchmakingApi } from "@/lib/room/useMatchmaking";
import type { Language } from "@/lib/types/game-config";

interface SearchRunnerProps {
  startedAt: number;
  language: Language;
  onState: (api: MatchmakingApi) => void;
}

/**
 * One search, from its start to its end (spec 070 US5, R11): mounted by the
 * standing provider under a key per search, so a new search starts clean. It
 * renders nothing; the line slot shows its state on every page.
 */
export function SearchRunner({ startedAt, language, onState }: SearchRunnerProps) {
  const api = useMatchmaking(true, startedAt, language);
  const latest = useRef(api);
  useEffect(() => {
    latest.current = api;
  });
  // The state is rebuilt each render; the provider hears only when it changes.
  const key = JSON.stringify(api.state);
  useEffect(() => {
    onState(latest.current);
  }, [key, onState]);
  return null;
}
