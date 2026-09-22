import type { Language } from "@/lib/types/game-config";

/**
 * Every language the site is served in (spec 060). The interface language comes
 * from the URL; the game language of a match comes from the match row. Adding a
 * language is one entry here plus its copy, dictionary and language pack.
 */
export interface LocaleConfig<Id extends string = string> {
  id: Id;
  /** Path segment; empty for the default locale, which is served unprefixed. */
  segment: string;
  /** BCP 47 tag for `<html lang>` and `Intl` (Danish is `dk` in the URL, `da` here). */
  htmlLang: string;
  /** Game language of matches started from this locale. */
  language: Language;
  wordmark: string;
  /** Target of the ledger-foot language link. */
  switchTo: Id;
}

const LOCALE_TABLE = {
  is: { id: "is", segment: "", htmlLang: "is", language: "is", wordmark: "orðusta", switchTo: "en" },
  en: { id: "en", segment: "en", htmlLang: "en", language: "en", wordmark: "wottle", switchTo: "is" },
} as const satisfies Record<string, LocaleConfig<"is" | "en">>;

export type Locale = keyof typeof LOCALE_TABLE;

export interface LocaleRegistry<Id extends string> {
  get(id: Id): LocaleConfig<Id>;
  isLocale(value: string): value is Id;
  localePath(locale: Id, path: string): string;
  switchLocalePath(pathname: string, from: Id, to: Id): string;
  isLandingPath(pathname: string, locale: Id): boolean;
  localeForLanguage(language: Language): Id;
  /** The locale whose non-empty segment starts `pathname`, if any. */
  prefixedLocaleOf(pathname: string): Id | null;
}

function assertAbsolute(path: string): void {
  if (!path.startsWith("/")) {
    throw new Error(`localePath expects an absolute path, got "${path}"`);
  }
}

function withSegment(segment: string, path: string): string {
  if (!segment) return path;
  return path === "/" ? `/${segment}` : `/${segment}${path}`;
}

function firstSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

export function createLocaleRegistry<Id extends string>(
  table: Record<Id, LocaleConfig<Id>>,
): LocaleRegistry<Id> {
  const ids = Object.keys(table) as Id[];
  const get = (id: Id): LocaleConfig<Id> => table[id];
  const isLocale = (value: string): value is Id => ids.includes(value as Id);

  const prefixedLocaleOf = (pathname: string): Id | null => {
    const segment = firstSegment(pathname);
    return ids.find((id) => table[id].segment !== "" && table[id].segment === segment) ?? null;
  };

  const stripSegment = (pathname: string, locale: Id): string => {
    const { segment } = table[locale];
    if (!segment || firstSegment(pathname) !== segment) return pathname;
    const rest = pathname.slice(segment.length + 1);
    return rest === "" ? "/" : rest;
  };

  return {
    get,
    isLocale,
    prefixedLocaleOf,
    localePath(locale, path) {
      assertAbsolute(path);
      return withSegment(table[locale].segment, path);
    },
    switchLocalePath(pathname, from, to) {
      return withSegment(table[to].segment, stripSegment(pathname, from));
    },
    isLandingPath(pathname, locale) {
      const bare = stripSegment(pathname.replace(/(.)\/+$/, "$1"), locale);
      return bare === "/";
    },
    localeForLanguage(language) {
      const match = ids.find((id) => table[id].language === language);
      if (!match) throw new Error(`No locale plays ${language}`);
      return match;
    },
  };
}

const registry = createLocaleRegistry<Locale>(LOCALE_TABLE);

export const LOCALES: Record<Locale, LocaleConfig<Locale>> = LOCALE_TABLE;
export const LOCALE_IDS = Object.keys(LOCALE_TABLE) as Locale[];
export const DEFAULT_LOCALE: Locale = "is";

export const getLocale = registry.get;
export const isLocale = registry.isLocale;
export const localePath = registry.localePath;
export const switchLocalePath = registry.switchLocalePath;
export const isLandingPath = registry.isLandingPath;
export const localeForLanguage = registry.localeForLanguage;
export const prefixedLocaleOf = registry.prefixedLocaleOf;
