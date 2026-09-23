"use client";

import { useCallback, useEffect, useState } from "react";

const OPT_IN_KEY = "wottle.notifications";

function readOptIn(): boolean {
  try {
    return window.localStorage.getItem(OPT_IN_KEY) === "on";
  } catch {
    return false;
  }
}

function writeOptIn(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(OPT_IN_KEY, "on");
    else window.localStorage.removeItem(OPT_IN_KEY);
  } catch {
    // A viewer convenience: without storage it lasts the page.
  }
}

export interface NotificationsApi {
  /** The browser has the Notification API and has not been told no. */
  available: boolean;
  enabled: boolean;
  enable: () => Promise<boolean>;
  disable: () => void;
  /** Shown only while the tab is hidden, and only when enabled. */
  notify: (title: string, body?: string) => void;
}

/**
 * In-page OS notifications (spec 070 FR-013, game flow §7.7): opt-in only,
 * from `⋯ notifications · on` or `tell me when someone is here ▸`, never asked
 * on load; shown only while the tab is hidden. Web Push is phase 2.
 */
export function useNotifications(): NotificationsApi {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [optIn, setOptIn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
    setOptIn(readOptIn());
  }, []);

  const enable = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const next = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPermission(next);
    const on = next === "granted";
    setOptIn(on);
    writeOptIn(on);
    return on;
  }, []);
  const disable = useCallback(() => {
    setOptIn(false);
    writeOptIn(false);
  }, []);
  const enabled = permission === "granted" && optIn;
  const notify = useCallback(
    (title: string, body?: string) => {
      if (!enabled || document.visibilityState !== "hidden") return;
      new Notification(title, body ? { body } : undefined);
    },
    [enabled],
  );
  return { available: permission !== "unsupported" && permission !== "denied", enabled, enable, disable, notify };
}
