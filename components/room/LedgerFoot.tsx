"use client";

import type { ReactNode } from "react";

import Link from "next/link";

import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { getLocale, localePath } from "@/lib/i18n/locales";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { RoomMenu, type RoomMenuVariant } from "./RoomMenu";

interface LedgerFootProps {
  variant: RoomMenuVariant;
  actions?: ReactNode;
  onAction: (action: LedgerAction) => void;
}

/** The state's actions left (`how to play ▸` outside a match, spec 048 US5), the `⋯` menu right (design system §5.4). */
export function LedgerFoot({ variant, actions, onAction }: LedgerFootProps) {
  const { HOW_TO_PLAY, LANGUAGE_LINK } = useCopy();
  const to = useLocalePath();
  const locale = useLocale();
  const other = getLocale(locale.switchTo);
  // The other language's lobby: the same page from the lobby, and the way out after a
  // match, which keeps its own language (a signed-out visitor lands on the landing page).
  const languageHref = localePath(other.id, "/lobby");
  return (
    <div className="ledger__foot" data-testid="ledger-foot" data-field-safe>
      <div className="ledger__actions">
        {variant === "match" ? null : (
          <Link href={to("/rules")} className="action-secondary" data-testid="ledger-how-to-play">
            {HOW_TO_PLAY}
          </Link>
        )}
        {variant === "match" ? null : (
          // A full load, not a client navigation: the page's language, `<html lang>` and title all change.
          <a href={languageHref} lang={other.htmlLang} className="action-secondary" data-testid="ledger-language">
            {LANGUAGE_LINK}
          </a>
        )}
        {actions}
      </div>
      <RoomMenu variant={variant} onAction={onAction} />
    </div>
  );
}
