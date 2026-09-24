"use client";

import type { ReactNode } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";

import { Folio, type PagePlace } from "./Folio";
import { DoorMasthead, DoorPreferLine, SignedInMasthead, type MastheadViewer } from "./Masthead";
import { PageMenu, type SignOutState } from "./PageMenu";
import { SkipToCall } from "./LineSlot";
import { SlotTerms } from "./SlotTerms";

type PageFrameProps =
  | {
      variant: "door";
      place: null;
      doorCount: string | null;
      /** F1: the phone masthead's shorter count. */
      doorCountPhone?: string | null;
      preferOther?: boolean;
      children: ReactNode;
    }
  | {
      variant: "signedIn";
      place: PagePlace;
      /** Null for a signed-out visitor on a public page: no line slot. */
      viewer: MastheadViewer | null;
      otherLobbyHere: number | null;
      /** The line slot's content; the slot's height is reserved either way (§5.0). */
      slot?: ReactNode;
      signOut?: SignOutState;
      menuExtra?: ReactNode;
      /** The standing state pinned to a phone's bottom edge, and its height (§5.0 phone frame). */
      bottomSlot?: ReactNode;
      bottomHeight?: number;
      /** While a call is up, a skip link to it is the page's first focusable element. */
      skipLabel?: string | null;
      /** Spec 072: the folio names whose page it is (`Orðusta · prófíll · birna`). */
      folioDetail?: string | null;
      children: ReactNode;
    };

/**
 * A page where there is no field (spec 070 FR-002, game flow §5.0): the
 * masthead and, signed in, the sticky line slot (`banner`), the content
 * (`main`), and the folio (`contentinfo`). On the room's grid.
 */
export function PageFrame(props: PageFrameProps) {
  const copy = useCopy();
  if (props.variant === "door") {
    const preferOther = props.preferOther ?? false;
    return (
      <div className="page page--door">
        <header className="page-head" role="banner">
          <DoorMasthead doorCount={props.doorCount} doorCountPhone={props.doorCountPhone ?? null} preferOther={preferOther} />
          <DoorPreferLine preferOther={preferOther} />
        </header>
        <main className="page-main" aria-label={copy.pages.MAIN}>{props.children}</main>
        <Folio place={null} />
      </div>
    );
  }
  const menu = <PageMenu signOut={props.signOut ?? {}} extra={props.menuExtra} />;
  const bottom = props.bottomHeight ?? 0;
  return (
    <div className="page page--signed-in" style={{ ["--bottom-slot-h" as string]: `${bottom}px` }} data-bottom-slot={bottom > 0}>
      {props.skipLabel ? <SkipToCall label={props.skipLabel} /> : null}
      <header className="page-head page-head--sticky" role="banner">
        <SignedInMasthead viewer={props.viewer} otherLobbyHere={props.otherLobbyHere} menu={menu} />
        {props.viewer ? <div className="page-slot" data-testid="line-slot">{props.slot ?? <SlotTerms counts={null} />}</div> : null}
      </header>
      <main className="page-main" aria-label={copy.pages.MAIN}>{props.children}</main>
      <Folio place={props.place} detail={props.folioDetail ?? null} />
      {props.bottomSlot ? <div className="page-bottom">{props.bottomSlot}</div> : null}
    </div>
  );
}
