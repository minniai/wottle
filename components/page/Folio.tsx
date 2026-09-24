"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";

export type PagePlace = "lobby" | "profile" | "rules";

/** The folio names the place only (game flow §5.0): no colophon, no ©. */
export function Folio({ place, detail = null }: { place: PagePlace | null; detail?: string | null }) {
  const copy = useCopy();
  const names: Record<PagePlace, string> = { lobby: copy.pages.PLACE_LOBBY, profile: copy.pages.PLACE_PROFILE, rules: copy.pages.PLACE_RULES };
  return (
    <footer className="page-folio" role="contentinfo">
      {copy.pages.folio(copy.WORDMARK, place ? (detail ? `${names[place]} · ${detail}` : names[place]) : null)}
    </footer>
  );
}
