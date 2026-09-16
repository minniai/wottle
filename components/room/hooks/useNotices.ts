"use client";

import { useCallback, useEffect, useState } from "react";

import type { Notice } from "@/lib/room/ledgerTypes";
import { addNotice, expireNotices, removeKind } from "@/lib/room/notices";

export interface NoticesApi {
  notices: Notice[];
  push: (notice: Notice) => void;
  dismiss: (kind: Notice["kind"]) => void;
}

/** Live-row-styled notices with expiry (resign confirm 5 s). */
export function useNotices(): NoticesApi {
  const [notices, setNotices] = useState<Notice[]>([]);
  const push = useCallback((notice: Notice) => setNotices((prev) => addNotice(prev, notice)), []);
  const dismiss = useCallback((kind: Notice["kind"]) => setNotices((prev) => removeKind(prev, kind)), []);

  useEffect(() => {
    if (!notices.some((n) => "expiresAt" in n)) return;
    const timer = setInterval(() => setNotices((prev) => expireNotices(prev, Date.now())), 250);
    return () => clearInterval(timer);
  }, [notices]);

  return { notices, push, dismiss };
}
