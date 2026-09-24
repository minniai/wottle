import { getLocale, localeForLanguage, localePath, type Locale } from "@/lib/i18n/locales";
import type { Language } from "@/lib/types/game-config";
import type { MatchEndedReason, MatchPhase } from "@/lib/types/match";

export interface MatchPageFacts {
  locale: Locale;
  matchId: string;
  /** The request's query, kept on every redirect (`?review=5`). */
  search: string;
  signedIn: boolean;
  participant: boolean;
  match: { state: MatchPhase; endedReason: MatchEndedReason | null | undefined; language: Language } | null;
}

export type MatchPageDecision = { kind: "render"; readOnly: boolean } | { kind: "redirect"; to: string };

/**
 * Spec 071 (FR-042; spec 060 FR-015; spec 069): who sees a match page, and as what. A finished
 * match (not a void table) is readable by anyone, signed in or not; a live one only by its
 * players; the page always speaks the match's language; every redirect keeps the query.
 */
export function matchPageAccess(facts: MatchPageFacts): MatchPageDecision {
  const { locale, matchId, search, signedIn, participant, match } = facts;
  const here = localePath(locale, `/match/${matchId}${search}`);
  const door = { kind: "redirect", to: localePath(locale, `/?next=${encodeURIComponent(here)}`) } as const;
  if (!match) return signedIn ? { kind: "redirect", to: localePath(locale, `/?notice=no-match&match=${encodeURIComponent(matchId)}`) } : door;
  if (match.language !== getLocale(locale).language) return { kind: "redirect", to: localePath(localeForLanguage(match.language), `/match/${matchId}${search}`) };
  if (participant) return { kind: "render", readOnly: false };
  const finished = (match.state === "completed" || match.state === "abandoned") && match.endedReason !== "void";
  if (finished) return { kind: "render", readOnly: true };
  if (match.endedReason === "void" || signedIn) return { kind: "redirect", to: localePath(locale, "/") };
  return door;
}
