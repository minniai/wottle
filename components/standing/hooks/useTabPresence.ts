"use client";

import { useEffect, useRef } from "react";

import { useAttention } from "@/components/room/hooks/useAttention";
import { HEARTBEAT_HIDDEN_MS, HEARTBEAT_VISIBLE_MS } from "@/lib/presence/constants";
import type { PresencePage } from "@/lib/types/standing";

const TAB_KEY = "wottle.tabId";
const BEAT_URL = "/api/presence/beat";
const LEAVE_URL = "/api/presence/leave";

/** The tab keeps its id across a reload, so a reload never drops the player (US6.3). Storage may throw. */
function tabId(): string {
  try {
    const kept = window.sessionStorage.getItem(TAB_KEY);
    if (kept) return kept;
    const made = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_KEY, made);
    return made;
  } catch {
    return crypto.randomUUID();
  }
}

export function pageOf(pathname: string): PresencePage {
  const path = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (path === "/") return "lobby";
  if (path === "/rules") return "rules";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/match/")) return "match";
  return "other";
}

/**
 * This tab's heartbeat (spec 070 US6, FR-027): at once, then every 10s while
 * visible and every 30s while hidden, with the tab's visibility and last input
 * and the page it is on. On `pagehide` a beacon says it is leaving; unless it
 * beats again within 8s, it is gone.
 */
export function useTabPresence(page: PresencePage): void {
  const attention = useAttention();
  const id = useRef<string | null>(null);
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    id.current ??= tabId();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const send = () => {
      const { visible, inputAgoMs } = attention();
      void fetch(BEAT_URL, {
        method: "POST",
        keepalive: true,
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tabId: id.current, visible, inputAgoMs: Math.round(inputAgoMs), page: pageRef.current }),
      }).catch(() => undefined);
      timer = setTimeout(send, visible ? HEARTBEAT_VISIBLE_MS : HEARTBEAT_HIDDEN_MS);
    };
    const restart = () => {
      if (timer) clearTimeout(timer);
      send();
    };
    const leaving = () => {
      const body = new Blob([JSON.stringify({ tabId: id.current })], { type: "text/plain;charset=UTF-8" });
      navigator.sendBeacon?.(LEAVE_URL, body);
    };
    send();
    document.addEventListener("visibilitychange", restart);
    window.addEventListener("pagehide", leaving);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("pagehide", leaving);
    };
  }, [attention]);

  // A page change beats at once, so the lobby sees where the player went.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const { visible, inputAgoMs } = attention();
    void fetch(BEAT_URL, {
      method: "POST",
      keepalive: true,
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tabId: id.current, visible, inputAgoMs: Math.round(inputAgoMs), page }),
    }).catch(() => undefined);
  }, [page, attention]);
}
