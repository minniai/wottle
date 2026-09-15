"use client";

import { useEffect, useState } from "react";

/** The one breakpoint the room has: below it the ledger collapses (design system §4). */
export const PHONE_QUERY = "(max-width: 900px)";

/**
 * Whether the room is in its one-column layout.
 *
 * False on the server and on the first client render: the desktop ledger is the
 * safe first paint, and a phone corrects it on hydration. Guessing from a
 * user-agent header would make the fixture route's output depend on the request.
 */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE_QUERY);
    const sync = () => setIsPhone(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isPhone;
}
