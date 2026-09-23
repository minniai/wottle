"use client";

import { useEffect, useRef } from "react";

import { TABLE_CHECK_POLL_MS } from "@/lib/constants/table";
import { attentionQuery, type Attention } from "@/lib/matchmaking/attention";

export interface TableStatusAnswer {
  cooldownUntil: string | null;
  notice: "table_missed" | null;
}

interface TableCheckOptions {
  enabled: boolean;
  attention: () => Attention;
  /** A table (or a live match) waits for the player: go to it. */
  onTable: (matchId: string) => void;
  onStatus?: (status: TableStatusAnswer) => void;
}

/**
 * Every room page asks every 3s whether a table waits for the player (spec 069
 * FR-025a), and reports the tab's attention as it asks, so a player present on
 * any page is seated at creation. Stage 4's push replaces the poll.
 */
export function useTableCheck({ enabled, attention, onTable, onStatus }: TableCheckOptions): void {
  const seen = useRef<string | null>(null);
  const callbacks = useRef({ attention, onTable, onStatus });
  useEffect(() => {
    callbacks.current = { attention, onTable, onStatus };
  }, [attention, onTable, onStatus]);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    const ask = async () => {
      try {
        const res = await fetch(`/api/match/active?${attentionQuery(callbacks.current.attention())}`, { cache: "no-store" });
        if (!mounted || !res.ok) return;
        const body = (await res.json()) as { match?: { id: string } | null } & Partial<TableStatusAnswer>;
        callbacks.current.onStatus?.({ cooldownUntil: body.cooldownUntil ?? null, notice: body.notice ?? null });
        if (body.match?.id && seen.current !== body.match.id) {
          seen.current = body.match.id;
          callbacks.current.onTable(body.match.id);
        }
      } catch {
        // transient; the next ask retries
      }
    };
    void ask();
    const timer = setInterval(ask, TABLE_CHECK_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [enabled]);
}
