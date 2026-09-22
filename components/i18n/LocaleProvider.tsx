"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";

import type { Copy } from "@/lib/i18n/copy/types";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, localePath, type Locale, type LocaleConfig } from "@/lib/i18n/locales";

/**
 * The page's locale (spec 060), set once by the `[locale]` layout. Outside a
 * provider — a component rendered on its own in a unit test or a fixture — the
 * room reads English, the language its tests and baselines are written in.
 */
const FALLBACK_LOCALE: Locale = "en";

const LocaleContext = createContext<Locale>(FALLBACK_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleConfig<Locale> {
  return getLocale(useContext(LocaleContext));
}

export function useLocalePath(): (path: string) => string {
  const locale = useContext(LocaleContext);
  return useCallback((path: string) => localePath(locale, path), [locale]);
}

/** The page's strings (spec 060): Icelandic under `/`, English under `/en`. */
export function useCopy(): Copy {
  return getCopy(useContext(LocaleContext));
}
