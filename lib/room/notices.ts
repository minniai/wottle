import { challengeNotice, claimWinLine, FIRST_MATCH_RULES, PICK_CLEARED_OPPONENT, rematchRequest, RESIGN_CONFIRM } from "@/lib/constants/copy";
import type { Notice } from "./ledgerTypes";

export const RESIGN_CONFIRM_MS = 5_000;

/** Text for a notice line (design system §8). Notices with actions render their own controls. */
export function noticeText(notice: Notice): string {
  switch (notice.kind) {
    case "pickCleared":
      return PICK_CLEARED_OPPONENT;
    case "rematchRequest":
      return rematchRequest(notice.requesterName);
    case "resignConfirm":
      return RESIGN_CONFIRM;
    case "firstMatchRules":
      return FIRST_MATCH_RULES;
    case "claimWin":
      return claimWinLine(notice.opponentName);
    case "challenge":
      return challengeNotice(notice.fromName);
    case "text":
      return notice.text;
  }
}

/** Notices replace their own kind, so a repeated line never stacks. */
export function addNotice(notices: Notice[], notice: Notice): Notice[] {
  return [...removeKind(notices, notice.kind), notice];
}

export function removeKind(notices: Notice[], kind: Notice["kind"]): Notice[] {
  return notices.filter((n) => n.kind !== kind);
}

export function expireNotices(notices: Notice[], now: number): Notice[] {
  return notices.filter((n) => !("expiresAt" in n) || n.expiresAt > now);
}

export function resignConfirm(now = Date.now()): Notice {
  return { kind: "resignConfirm", expiresAt: now + RESIGN_CONFIRM_MS };
}
