import { challengeNotice, pickClearedMoved, rematchRequest } from "@/lib/constants/copy";
import type { Notice } from "./ledgerTypes";

/** Text for a notice line (design system §8). Notices with actions render their own controls. */
export function noticeText(notice: Notice): string {
  switch (notice.kind) {
    case "pickCleared":
      return pickClearedMoved(notice.byName);
    case "rematchRequest":
      return rematchRequest(notice.requesterName);
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

/** No notice kind carries an expiry since the resign confirmation became a slip (spec 048 US7); kept for a future timed line. */
export function expireNotices(notices: Notice[], now: number): Notice[] {
  return notices.filter((n) => {
    const expiresAt = (n as { expiresAt?: number }).expiresAt;
    return expiresAt === undefined || expiresAt > now;
  });
}
