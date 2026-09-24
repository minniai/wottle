import type { Copy } from "@/lib/i18n/copy/types";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import type { Language } from "@/lib/types/game-config";
import type { PresenceWord } from "@/lib/types/profile";
import type { LobbyRow } from "@/lib/types/standing";

/**
 * Another player's presence as their profile says it (spec 072 FR-041): one
 * word or phrase, never a time. `otherLanguage` names the lobby they are in
 * when it is not this one.
 */
export function presenceLine(presence: PresenceWord, copy: Copy, otherLanguage: Language): string {
  switch (presence.state) {
    case "in_match":
      return copy.pages.presenceInMatch(presence.movesPlayed ?? 0, TOTAL_MOVES);
    case "other_lobby":
      return copy.pages.presenceOtherLobby(otherLanguage === "is" ? copy.pages.LOBBY_NAME_IS : copy.pages.LOBBY_NAME_EN);
    default:
      return copy.pages.PRESENCE[presence.state];
  }
}

/** A live lobby row (spec 070's presence) read as a presence word: searching is here. */
export function presenceFromRow(row: LobbyRow): PresenceWord {
  if (row.state === "in_match") return { state: "in_match", movesPlayed: row.movesPlayed };
  return { state: row.state === "away" ? "away" : "here", movesPlayed: null };
}
