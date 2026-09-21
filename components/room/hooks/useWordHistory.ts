"use client";

import { useEffect, useState } from "react";

import type { HistoryWord, MatchWordHistory } from "@/lib/match/wordHistory";

interface Loaded {
  matchId: string;
  resolvedSeq: number;
  words: HistoryWord[];
}

function isHistory(body: unknown): body is MatchWordHistory {
  return typeof body === "object" && body !== null && Array.isArray((body as MatchWordHistory).words);
}

async function fetchHistory(matchId: string): Promise<HistoryWord[] | null> {
  if (typeof fetch !== "function") return null;
  try {
    const res = await fetch(`/api/match/${matchId}/words`, { cache: "no-store" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isHistory(body) && body.matchId === matchId ? body.words : null;
  } catch {
    return null;
  }
}

/**
 * The resolved moves' words for the match on screen (spec 047 FR-003, spec
 * 050). Fetched once per match and again when the resolution cursor jumps by
 * more than one — a missed broadcast — never on the move path. `null` until
 * loaded or when the request fails; the ledger then fills from broadcasts alone.
 */
export function useWordHistory(matchId: string, resolvedSeq: number): HistoryWord[] | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const stale = loaded?.matchId !== matchId || resolvedSeq - loaded.resolvedSeq > 1;

  useEffect(() => {
    if (!stale) return;
    let active = true;
    void fetchHistory(matchId).then((words) => {
      if (active && words) setLoaded({ matchId, resolvedSeq, words });
    });
    return () => {
      active = false;
    };
  }, [matchId, resolvedSeq, stale]);

  return loaded?.matchId === matchId ? loaded.words : null;
}
