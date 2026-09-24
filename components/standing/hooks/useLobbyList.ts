"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { POLL_FALLBACK_MS, POLL_LIVE_MS } from "@/lib/presence/constants";
import { subscribeBroadcast } from "@/lib/realtime/broadcast";
import { lobbyRowSchema, type LobbyLanguage, type LobbyRow } from "@/lib/types/standing";

const rowsSchema = lobbyRowSchema.array();

/**
 * Who is here in a lobby (spec 070 US2, research R2): read on mount, on every
 * `lobby:{language}` poke, once more after a leaving tab's grace, and on a
 * fallback poll (3s without the channel, 12s with it).
 */
export function useLobbyList(language: LobbyLanguage, initial: LobbyRow[]): LobbyRow[] {
  const [rows, setRows] = useState<LobbyRow[]>(initial);
  const [joined, setJoined] = useState(false);
  const alive = useRef(true);

  const read = useCallback(async () => {
    const response = await fetch(`/api/lobby/players?language=${language}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok || !alive.current) return;
    const parsed = rowsSchema.safeParse((await response.json().catch(() => null))?.rows);
    if (parsed.success && alive.current) setRows(parsed.data);
  }, [language]);

  useEffect(() => {
    alive.current = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = subscribeBroadcast(
      `lobby:${language}`,
      (_event, payload) => {
        void read();
        const recheck = typeof payload.recheckInMs === "number" ? payload.recheckInMs : null;
        if (recheck) timers.add(setTimeout(() => void read(), recheck));
      },
      setJoined,
    );
    void read();
    return () => {
      alive.current = false;
      timers.forEach(clearTimeout);
      unsubscribe();
    };
  }, [language, read]);

  useEffect(() => {
    const id = setInterval(() => void read(), joined ? POLL_LIVE_MS : POLL_FALLBACK_MS);
    return () => clearInterval(id);
  }, [joined, read]);

  return rows;
}
