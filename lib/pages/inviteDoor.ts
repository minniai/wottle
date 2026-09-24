import type { Copy } from "@/lib/i18n/copy/types";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { formatClock } from "@/lib/room/clock";
import type { LinkView } from "@/lib/types/link";

export interface InviteDoorModel {
  band: { line1: string; line2: string | null; expired: boolean };
  primary: { label: string; action: "accept" | "enterLobby" };
  secondary: { label: string; action: "enterLobby" } | null;
  consequence: string | null;
}

/**
 * The invite door (spec 072 A2): the call band naming the sender, then
 * `accept ▸`. An unknown, used, cancelled or run-out link reads the same, so
 * the page never says which (FR-013).
 */
export function inviteDoorModel(view: LinkView | null, nowMs: number, copy: Copy, state: "empty" | "returning" = "empty"): InviteDoorModel {
  const leftMs = view ? Date.parse(view.expiresAt) - nowMs : 0;
  if (!view || !view.valid || leftMs <= 0) {
    return {
      band: { line1: copy.pages.LINK_EXPIRED_NOTE, line2: null, expired: true },
      primary: { label: copy.ENTER_LOBBY, action: "enterLobby" },
      secondary: null,
      consequence: null,
    };
  }
  return {
    band: { line1: copy.pages.callLine1(view.senderName), line2: copy.pages.inviteLine2(String(view.senderRating), copy.LANGUAGE_WORDS, formatClock(leftMs)), expired: false },
    primary: { label: copy.ACCEPT, action: "accept" },
    secondary: { label: copy.pages.ENTER_LOBBY_INSTEAD, action: "enterLobby" },
    consequence: (state === "returning" ? copy.pages.acceptSeatsYou : copy.pages.acceptSignsYouIn)(view.senderName),
  };
}

/** The lobby with a link's call in its slot (research R6): `/?invite=…` or `/en?invite=…`. */
export function lobbyWithInvite(locale: Locale, token: string): string {
  return `${localePath(locale, "/")}?invite=${token}`;
}
