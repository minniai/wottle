import { LINK_TTL_MS } from "@/lib/constants/links";
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
    case "linkCall":
      return { find: "secondary", note: null };
    case "link":
      return slot.link && !slot.held ? { find: "secondary", note: copy.pages.FINDING_CANCELS_LINK } : { find: opts.composing ? "secondary" : "primary", note: null };
    case "match":
      return slot.match.kind === "over" ? { find: "secondary", note: null } : { find: "hidden", note: copy.pages.FINISH_FIRST };
    case "switch":
      // In the other lobby with something out: nothing can start here until the switch is confirmed (US7.4).
      return { find: "hidden", note: null };
    case "sent":
      return slot.held ? { find: opts.composing ? "secondary" : "primary", note: null } : { find: "secondary", note: copy.pages.WITHDRAWS_YOUR_CHALLENGE };
    case "search":
      return { find: "hidden", note: null };
    default:
      return { find: opts.composing ? "secondary" : "primary", note: null };
  }
}

export interface LobbyPrimaryModel {
  /** `invite a friend ▸` (spec 072 B1): the primary of an empty lobby, a secondary otherwise. */
  invite: "primary" | "secondary" | "hidden";
  find: PagePrimaryModel;
  /** Under a secondary invite: `a link that works for 10 minutes`. */
  inviteNote: string | null;
}

/**
 * The lobby block's two ways to play (spec 072 FR-001): with no one else here,
 * `invite a friend ▸` takes the primary and find steps down; with others here,
 * find keeps it. Invite never rises over a slot that has held find down.
 */
export function lobbyPrimary(input: { othersHere: number; find: PagePrimaryModel; copy: Copy }): LobbyPrimaryModel {
  const { othersHere, find, copy } = input;
  if (find.find === "hidden") return { invite: "hidden", find, inviteNote: null };
  const note = copy.pages.linkWorksFor(Math.round(LINK_TTL_MS / 60_000));
  if (othersHere === 0 && find.find === "primary") return { invite: "primary", find: { find: "secondary", note: find.note }, inviteNote: null };
  if (othersHere === 0) return { invite: "secondary", find, inviteNote: null };
  return { invite: "secondary", find, inviteNote: note };
}
