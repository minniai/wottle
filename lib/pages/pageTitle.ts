import type { Copy } from "@/lib/i18n/copy/types";
import { formatClock } from "@/lib/room/clock";

import type { SlotState } from "./standingSlot";

/**
 * The tab title on a page (spec 070 FR-011, game flow §7.7), written by the
 * standing state; null leaves the page's own title. The match page writes its
 * own titles while its controller is mounted (spec 069).
 */
export function pageTitle(slot: SlotState, copy: Copy, ctx: { nowMs: number; calls: number; arrival: string | null }): string | null {
  const wm = copy.WORDMARK;
  const left = (iso: string | null) => formatClock(iso ? Math.max(0, Date.parse(iso) - ctx.nowMs) : 0);
  if (ctx.arrival && slot.kind !== "call") return `${copy.pages.arrived(ctx.arrival)} · ${wm}`;
  switch (slot.kind) {
    case "call":
      return `${copy.pages.titleCall(ctx.calls, slot.call.from.displayName)} · ${wm}`;
    case "match":
      if (slot.match.kind === "over") {
        const verdict = slot.match.winnerName ? copy.verdictLine(slot.match.winnerName, Math.max(slot.match.you, slot.match.them), Math.min(slot.match.you, slot.match.them)) : copy.drawLine(slot.match.you, slot.match.them);
        return `${verdict} · ${wm}`;
      }
      return slot.match.kind === "running" ? `${copy.pages.titleRunning(left(slot.match.deadlineAt))} · ${wm}` : `${copy.table.titleTable(slot.match.opponent)} · ${wm}`;
    case "sent":
      return slot.outgoing?.status === "pending" && !slot.held ? `${copy.pages.titleSent(left(slot.outgoing.expiresAt))} · ${wm}` : null;
    case "linkCall":
      return `${copy.pages.linkCallLine1(slot.call.view.senderName)} · ${wm}`;
    case "link":
      return slot.link?.status === "pending" && !slot.held ? `${copy.pages.titleLink(left(slot.link.expiresAt))} · ${wm}` : null;
    case "search":
      return slot.search.kind === "searching" ? `${copy.table.titleSearching(formatClock(slot.search.elapsedSeconds * 1000))} · ${wm}` : null;
    default:
      return null;
  }
}
