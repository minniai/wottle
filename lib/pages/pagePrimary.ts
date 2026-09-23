import type { Copy } from "@/lib/i18n/copy/types";

import type { SlotState } from "./standingSlot";

export interface PagePrimaryModel {
  /** `find an opponent ▸`: the primary, a secondary, or not drawn. */
  find: "primary" | "secondary" | "hidden";
  /** The line beneath it: why it stepped down, or what pressing it would cancel. */
  note: string | null;
}

/**
 * The lobby block's one primary (spec 070, contracts/page-derivations.md;
 * design system §8 item 3): slip > line-slot call > composer send > page
 * primary. A wait has no primary; a running match has none either.
 */
export function pagePrimary(slot: SlotState, copy: Copy, opts: { composing: boolean }): PagePrimaryModel {
  switch (slot.kind) {
    case "call":
      return { find: "secondary", note: null };
    case "match":
      return slot.match.kind === "over" ? { find: "secondary", note: null } : { find: "hidden", note: copy.pages.FINISH_FIRST };
    case "switch":
      return { find: "secondary", note: null };
    case "sent":
      return slot.held ? { find: opts.composing ? "secondary" : "primary", note: null } : { find: "secondary", note: copy.pages.WITHDRAWS_YOUR_CHALLENGE };
    case "search":
      return { find: "hidden", note: null };
    default:
      return { find: opts.composing ? "secondary" : "primary", note: null };
  }
}
