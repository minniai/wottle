"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";

import { LanguageSwitch } from "./LanguageSwitch";

export interface SignOutState {
  /** A live match: signing out is refused, with this reason (spec 067). */
  disabledReason?: string | null;
  /** A search or challenge is out: this line comes before the item (game flow B1). */
  consequence?: string | null;
}

interface PageMenuProps {
  /** Your name: the menu's trigger (2026-09-26; it was a `⋯` at 11px, and your profile a link beside it). */
  viewerName: string;
  signOut: SignOutState;
  /** Items a provider adds (spec 070: notifications). */
  extra?: ReactNode;
}

function useDismiss(open: boolean, close: () => void, root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close, root]);
}

/**
 * The page masthead's menu (game flow B1), opened from your name: your
 * profile, sound, notifications, sign out. A plain list, no dialog; open, the
 * name and the list are one ruled shape.
 */
export function PageMenu({ viewerName, signOut, extra }: PageMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sound = usePreferencesStore((s) => s.soundEnabled);
  const setSound = usePreferencesStore((s) => s.setSoundEnabled);
  const copy = useCopy();
  const to = useLocalePath();
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef);

  const toggle = () => setOpen((v) => !v);
  const doSignOut = () => {
    close();
    // Refused during a live match; it never resigns (spec 067).
    void logoutAction().then((r) => {
      if (r.status === "refused") return;
      router.replace(to("/"));
      router.refresh();
    });
  };

  return (
    <div ref={rootRef} className="page-menu" data-testid="page-menu">
      <button
        type="button"
        className="page-link page-link--you page-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${viewerName} · ${copy.MENU}`}
        onClick={toggle}
        data-testid="page-menu-trigger"
      >
        <span className="page-square page-square--you" aria-hidden="true" />
        {viewerName} {open ? "▴" : "▾"}
      </button>
      {open ? (
        <ul className="page-menu__list" role="menu">
          <li role="none" className="page-menu__you">
            <Link role="menuitem" href={to("/profile")} className="page-link page-link--ink" data-testid="page-menu-profile" onClick={close}>
              {`${copy.MENU_PROFILE} ▸`}
            </Link>
          </li>
          {/* Spec 072 FR-060: on a phone the rules are reached from here. */}
          <li role="none" className="page-only-phone">
            <Link role="menuitem" href={to("/rules")} className="page-link" data-testid="page-menu-rules" onClick={close}>
              {copy.HOW_TO_PLAY}
            </Link>
          </li>
          {/* On a phone the masthead has no room for the switch; it lives here (F2). */}
          <li role="none" className="page-only-phone">
            <LanguageSwitch variant="signedIn" />
          </li>
          {extra}
          <li role="none">
            <button type="button" role="menuitem" className="page-link" onClick={() => setSound(!sound)}>
              {copy.soundToggle(sound)}
            </button>
          </li>
          <li role="none" className="page-menu__last">
            {signOut.consequence ? <span className="page-menu__note">{signOut.consequence}</span> : null}
            {signOut.disabledReason ? (
              <span className="page-menu__note" data-testid="sign-out-disabled">{signOut.disabledReason}</span>
            ) : (
              <button type="button" role="menuitem" className="page-link" data-testid="page-menu-sign-out" onClick={doSignOut}>
                {copy.SIGN_OUT}
              </button>
            )}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
