"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import type { Copy } from "@/lib/i18n/copy/types";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import type { LedgerAction } from "@/lib/room/ledgerTypes";

export type RoomMenuVariant = "lobby" | "match" | "final";

interface RoomMenuProps {
  variant: RoomMenuVariant;
  onAction: (action: LedgerAction) => void;
}

interface Item {
  key: string;
  label: string;
  action?: LedgerAction;
  /** A link, not an action: the rules page opens in a new tab so the match keeps running (spec 048 US5). */
  href?: string;
  /** Text to copy to the clipboard (spec 072: the review's link). */
  copy?: string;
}

const COPIED_MS = 2_000;

interface MenuState {
  sound: boolean;
  rulesHref: string;
  copy: Copy;
  /** Spec 072 (Q3): the review's link, copied by `copy link ▸`; null off a finished match. */
  reviewLink: string | null;
  copied: boolean;
}

/** The match's review link, from the page's own path (`/match/:id` or `/en/match/:id`). */
function reviewLinkOf(pathname: string): string | null {
  if (!/\/match\/[0-9a-f-]{36}$/i.test(pathname) || typeof window === "undefined") return null;
  return `${window.location.origin}${pathname}?review=last`;
}

function itemsFor(variant: RoomMenuVariant, { sound, rulesHref, copy, reviewLink, copied }: MenuState): Item[] {
  const shared: Item[] = [{ key: "sound", label: copy.soundToggle(sound), action: "toggleSound" }];
  if (variant === "match") {
    return [
      ...shared,
      { key: "howToPlay", label: copy.MENU_HOW_TO_PLAY, href: rulesHref },
      { key: "resign", label: copy.MENU_RESIGN, action: "resign" },
      // Spec 070: `go to the lobby` opens the leave slip; it never resigns.
      { key: "leave", label: copy.pages.GO_TO_LOBBY, action: "leave" },
    ];
  }
  // After a match the rules stay one step away (the desktop final ledger has no foot, spec 068).
  const rules: Item[] = variant === "final" ? [{ key: "howToPlay", label: copy.MENU_HOW_TO_PLAY, href: rulesHref }] : [];
  const link: Item[] = variant === "final" && reviewLink ? [{ key: "copyLink", label: copied ? copy.pages.LINK_COPIED_SHORT : copy.pages.COPY_LINK, copy: reviewLink }] : [];
  return [...shared, ...rules, ...link, { key: "profile", label: copy.MENU_PROFILE, action: "profile" }, { key: "signout", label: copy.SIGN_OUT, action: "signOut" }];
}

/** The `⋯` menu in the ledger foot (design system §5.4). No dialog: a plain list. */
export function RoomMenu({ variant, onAction }: RoomMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sound = usePreferencesStore((s) => s.soundEnabled);
  const setSound = usePreferencesStore((s) => s.setSoundEnabled);
  const to = useLocalePath();
  const copy = useCopy();
  const pathname = usePathname() ?? "";
  const [copied, setCopied] = useState(false);
  // Opened from a match, the rules know where to send a tab the browser will not close (spec 072 FR-061).
  const rulesHref = /\/match\//.test(pathname) ? `${to("/rules")}?from=${encodeURIComponent(pathname)}` : to("/rules");

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  const select = (item: Item) => {
    if (item.copy) {
      void navigator.clipboard?.writeText(item.copy).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
      return;
    }
    if (!item.action) return;
    if (item.action === "toggleSound") setSound(!sound);
    onAction(item.action);
    if (item.action !== "toggleSound") close();
  };

  return (
    <div ref={rootRef} className="room-menu" data-testid="ledger-menu">
      <button
        type="button"
        className="action-secondary room-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={copy.MENU}
        data-testid="ledger-menu-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <ul className="room-menu__list" role="menu" data-testid="ledger-menu-list">
          {itemsFor(variant, { sound, rulesHref, copy, reviewLink: reviewLinkOf(pathname), copied }).map((item) => (
            <li key={item.key} role="none">
              {item.href ? (
                <a role="menuitem" className="action-secondary" data-testid={`ledger-menu-item-${item.key}`} href={item.href} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              ) : (
                <button type="button" role="menuitem" className="action-secondary" data-testid={`ledger-menu-item-${item.key}`} onClick={() => select(item)}>
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
