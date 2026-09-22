"use client";

import { useCallback, useEffect, useState } from "react";

import type { Notice } from "@/lib/room/ledgerTypes";
import { addNotice, expireNotices, removeKey } from "@/lib/room/notices";

export interface NoticesApi {
  notices: Notice[];
  push: (notice: Notice) => void;
  /** By key: a kind, or `challenge:<inviteId>` for one challenge (`noticeKey`). */
  dismiss: (key: string) => void;
  /** Rewrite the list from the previous one (a poll syncing its lines). */
  apply: (next: (prev: Notice[]) => Notice[]) => void;
}

/** Live-row-styled notices; one with `expiresAt` leaves on its own (a cleared pick, 2 s). */
export function useNotices(): NoticesApi {
  const [notices, setNotices] = useState<Notice[]>([]);
  const push = useCallback((notice: Notice) => setNotices((prev) => addNotice(prev, notice)), []);
  const dismiss = useCallback((key: string) => setNotices((prev) => removeKey(prev, key)), []);
  const apply = useCallback((next: (prev: Notice[]) => Notice[]) => setNotices(next), []);

  useEffect(() => {
    if (!notices.some((n) => "expiresAt" in n)) return;
    const timer = setInterval(() => setNotices((prev) => expireNotices(prev, Date.now())), 250);
    return () => clearInterval(timer);
  }, [notices]);

  return { notices, push, dismiss, apply };
}
