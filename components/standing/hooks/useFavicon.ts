"use client";

import { useEffect } from "react";

import type { Locale } from "@/lib/i18n/locales";

/**
 * The favicon's letter turns the opponent's colour while a call waits
 * (game flow §6, spec 070 FR-006). Best effort: the title's `(1)` is the
 * signal that counts; some browsers cache the icon.
 */
export function useFavicon(locale: Locale, calling: boolean): void {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    const base = `/brand/cell-${locale}.svg`;
    link.href = calling ? `/brand/cell-${locale}-call.svg` : base;
    return () => {
      link.href = base;
    };
  }, [locale, calling]);
}
