import { challengeNotice, claimWinLine, FIRST_MATCH_RULES, frozenNotice, PICK_CLEARED_OPPONENT, rematchRequest, RESIGN_CONFIRM } from "@/lib/constants/copy";
import type { Notice } from "./ledgerTypes";

export const FROZEN_NOTICE_MS = 2_000;
export const RESIGN_CONFIRM_MS = 5_000;

/** Text for a notice line (design system §8). Notices with actions render their own controls. */
export function noticeText(notice: Notice): string {
  switch (notice.kind) {
    case "frozen":
      return frozenNotice(notice.ownerName, notice.round);
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

/** At most one transient pick notice at a time; timed notices replace their own kind. */
export function addNotice(notices: Notice[], notice: Notice): Notice[] {
  const transient = new Set(["frozen", "pickCleared"]);
  const kept = notices.filter((n) => !(transient.has(n.kind) && transient.has(notice.kind)) && n.kind !== notice.kind);
  return [...kept, notice];
}

export function removeKind(notices: Notice[], kind: Notice["kind"]): Notice[] {
  return notices.filter((n) => n.kind !== kind);
}

export function expireNotices(notices: Notice[], now: number): Notice[] {
  return notices.filter((n) => !("expiresAt" in n) || n.expiresAt > now);
}

export function frozen(ownerName: string, round: number, now = Date.now()): Notice {
  return { kind: "frozen", ownerName, round, expiresAt: now + FROZEN_NOTICE_MS };
}

export function resignConfirm(now = Date.now()): Notice {
  return { kind: "resignConfirm", expiresAt: now + RESIGN_CONFIRM_MS };
}
