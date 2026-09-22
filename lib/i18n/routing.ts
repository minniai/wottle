import { DEFAULT_LOCALE, getLocale, prefixedLocaleOf } from "@/lib/i18n/locales";

export type RouteDecision =
  | { kind: "next" }
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; to: string; status: 308 };

/**
 * What the proxy does with a page request (spec 060, contracts/locale-routing.md).
 * The default locale is served unprefixed: its explicit prefix redirects away and
 * every other unprefixed path is rewritten into its `[locale]` segment.
 */
export function decideLocaleRoute(pathname: string): RouteDecision {
  const defaultId = getLocale(DEFAULT_LOCALE).id;
  const [, first = ""] = pathname.split("/");
  if (first === defaultId) {
    const rest = pathname.slice(defaultId.length + 1);
    return { kind: "redirect", to: rest === "" ? "/" : rest, status: 308 };
  }
  if (prefixedLocaleOf(pathname)) {
    return { kind: "next" };
  }
  return { kind: "rewrite", to: pathname === "/" ? `/${defaultId}` : `/${defaultId}${pathname}` };
}
