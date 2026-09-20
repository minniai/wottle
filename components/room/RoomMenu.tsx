"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
}

function itemsFor(variant: RoomMenuVariant, sound: boolean, preview: boolean): Item[] {
  const shared: Item[] = [
    { key: "sound", label: `sound · ${sound ? "on" : "off"}`, action: "toggleSound" },
    { key: "preview", label: `preview · ${preview ? "on" : "off"}`, action: "togglePreview" },
  ];
  if (variant === "match") return [...shared, { key: "howToPlay", label: "how to play", href: "/rules" }, { key: "resign", label: "resign", action: "resign" }, { key: "leave", label: "leave", action: "leave" }];
  return [...shared, { key: "profile", label: "profile", action: "profile" }, { key: "signout", label: "sign out", action: "signOut" }];
}

/** The `⋯` menu in the ledger foot (design system §5.4). No dialog: a plain list. */
export function RoomMenu({ variant, onAction }: RoomMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sound = usePreferencesStore((s) => s.soundEnabled);
  const preview = usePreferencesStore((s) => s.previewEnabled);
  const setSound = usePreferencesStore((s) => s.setSoundEnabled);
  const setPreview = usePreferencesStore((s) => s.setPreviewEnabled);

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
    if (!item.action) return;
    if (item.action === "toggleSound") setSound(!sound);
    else if (item.action === "togglePreview") setPreview(!preview);
    onAction(item.action);
    if (item.action !== "toggleSound" && item.action !== "togglePreview") close();
  };

  return (
    <div ref={rootRef} className="room-menu" data-testid="ledger-menu">
      <button
        type="button"
        className="action-secondary room-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="menu"
        data-testid="ledger-menu-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <ul className="room-menu__list" role="menu" data-testid="ledger-menu-list">
          {itemsFor(variant, sound, preview).map((item) => (
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
