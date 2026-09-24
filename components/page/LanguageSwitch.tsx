"use client";

import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import { getLocale, localePath } from "@/lib/i18n/locales";

/**
 * The one language switch on a page (game flow A1, B1). A full load, not a
 * client navigation: the page's language, `<html lang>` and title all change.
 * On the door both languages show, the current one first and not a link; on
 * other pages only the other lobby, with how many are there (S10).
 */
export function LanguageSwitch({ variant, otherLobbyHere = null }: { variant: "door" | "signedIn"; otherLobbyHere?: number | null }) {
  const copy = useCopy();
  const locale = useLocale();
  const other = getLocale(locale.switchTo);
  const href = localePath(other.id, "/");
  const link = (
    <a href={href} lang={other.htmlLang} className="page-link" data-testid="language-switch">
      {variant === "door" ? copy.LANGUAGE_LINK : copy.pages.switchTo(otherLobbyHere)}
    </a>
  );
  if (variant === "signedIn") return link;
  // The link comes first in tab order; the current language is drawn before it.
  return (
    <span className="language-switch">
      <span className="language-switch__current" aria-current="true">{copy.pages.LANGUAGE_SELF}</span>
      <span aria-hidden="true"> · </span>
      {link}
    </span>
  );
}

/** When the browser prefers the other language, the switch is this one line instead (A1). It never redirects. */
export function PreferOtherLine() {
  const copy = useCopy();
  const locale = useLocale();
  const other = getLocale(locale.switchTo);
  return (
    <a href={localePath(other.id, "/")} lang={other.htmlLang} className="page-link page-prefer" data-testid="prefer-other">
      {copy.pages.preferOther}
    </a>
  );
}
