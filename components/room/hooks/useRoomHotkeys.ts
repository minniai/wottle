"use client";

import { useEffect } from "react";

import type { LedgerAction } from "@/lib/room/ledgerTypes";

/**
 * A key press that belongs to whatever the player is typing in, not to the room.
 * `closest` rather than the target itself, so a child of an editable region
 * counts too; the attribute rather than `isContentEditable`, which jsdom does
 * not compute.
 */
function isTyping(target: EventTarget | null): boolean {
  const el = target as Element | null;
  return Boolean(el?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

/**
 * The room's two hotkeys (design system §9, spec 045 FR-026): `?` opens the
 * `M` mutes (the `?` rules hotkey went with the in-room rules, spec 048 US5). Ignored while a text field has focus — the landing state's
 * name input must receive both characters — and while a modifier is held, so
 * browser and system shortcuts keep working.
 */
export function useRoomHotkeys(onAction: (action: LedgerAction) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (event.key === "m" || event.key === "M") onAction("toggleSound");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onAction]);
}
