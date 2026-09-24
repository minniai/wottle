"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { useIsPhone } from "@/components/room/hooks/useIsPhone";

import { LanguageSwitch, PreferOtherLine } from "./LanguageSwitch";
import { Strip } from "./Strip";

const STRIP_CELL_PX = 22;
const PHONE_STRIP_CELL_PX = 18;

export interface MastheadViewer {
  displayName: string;
  handle: string;
}

/** The door's masthead (A1): the here-now count left; the language switch, or none when the preference line is shown, right. */
export function DoorMasthead({ doorCount, doorCountPhone, preferOther }: { doorCount: string | null; doorCountPhone: string | null; preferOther: boolean }) {
  return (
    <div className="page-masthead">
      <div className="page-masthead__left">
        {doorCount ? <span className="page-label page-only-desktop">{doorCount}</span> : null}
        {doorCountPhone ? <span className="page-label page-only-phone" aria-hidden="true">{doorCountPhone}</span> : null}
      </div>
      <nav className="page-masthead__nav" data-testid="masthead-nav">
        {preferOther ? null : <LanguageSwitch variant="door" />}
      </nav>
    </div>
  );
}

export function DoorPreferLine({ preferOther }: { preferOther: boolean }): ReactNode {
  return preferOther ? (
    <div className="page-prefer-line">
      <PreferOtherLine />
    </div>
  ) : null;
}

interface SignedInMastheadProps {
  /** Null for a signed-out visitor on a public page (a profile, the rules): no square, no ⋯. */
  viewer: MastheadViewer | null;
  otherLobbyHere: number | null;
  menu: ReactNode;
}

/** A signed-in page's masthead (B1): the strip home left; how to play, the other lobby, you and ⋯ right. */
export function SignedInMasthead({ viewer, otherLobbyHere, menu }: SignedInMastheadProps) {
  const copy = useCopy();
  const locale = useLocale();
  const to = useLocalePath();
  const isPhone = useIsPhone();
  const onRules = /\/rules$/.test(usePathname() ?? "");
  return (
    <div className="page-masthead">
      <div className="page-masthead__left">
        <Link href={to("/")} className="page-strip-link" aria-label={copy.WORDMARK}>
          <Strip locale={locale.id} cellPx={isPhone ? PHONE_STRIP_CELL_PX : STRIP_CELL_PX} />
        </Link>
      </div>
      <nav className="page-masthead__nav" data-testid="masthead-nav">
        <Link href={to("/rules")} className="page-link" aria-current={onRules ? "page" : undefined} data-testid="masthead-rules">
          {copy.HOW_TO_PLAY}
        </Link>
        <LanguageSwitch variant="signedIn" otherLobbyHere={otherLobbyHere} />
        {viewer ? (
          <Link href={to("/profile")} className="page-link page-link--you">
            <span className="page-square page-square--you" aria-hidden="true" />
            {viewer.displayName} ▸
          </Link>
        ) : null}
        {viewer ? menu : null}
      </nav>
    </div>
  );
}
