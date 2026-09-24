"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import type { MovesResponse, ReviewStep } from "@/lib/types/review";

/** Spec 071 (FR-043): a completed match's moves, loaded once when review is wanted, as steps. */
export function useReviewMoves(matchId: string, enabled: boolean): { steps: ReviewStep[] | null; moves: MovesResponse | null } {
  const [moves, setMoves] = useState<MovesResponse | null>(null);
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || loaded.current === matchId) return;
    loaded.current = matchId;
    void fetch(`/api/match/${matchId}/moves`, { cache: "force-cache" })
      .then((res) => (res.ok ? (res.json() as Promise<MovesResponse>) : null))
      .then((body) => {
        if (body && loaded.current === matchId) setMoves(body);
      })
      .catch(() => {
        loaded.current = null;
      });
  }, [matchId, enabled]);
  const steps = useMemo(() => (moves ? buildReviewSteps(moves) : null), [moves]);
  return { moves, steps };
}
