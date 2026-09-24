import type { Copy } from "@/lib/i18n/copy/types";
import type { Notice } from "./ledgerTypes";

/** Text for a notice line (design system §8). Notices with actions render their own controls. */
export function noticeText(notice: Notice, copy: Copy): string {
  switch (notice.kind) {
    case "pickCleared":
      return copy.pickClearedMoved(notice.byName);
    case "rematchRequest":
      return copy.rematchRequest(notice.requesterName);
    case "text":
      return notice.text;
  }
}

/** A notice's identity is its kind. */
export function noticeKey(notice: Notice): string {
  return notice.kind;
}

/** Notices replace their own key, so a repeated line never stacks. */
export function addNotice(notices: Notice[], notice: Notice): Notice[] {
  return [...removeKey(notices, noticeKey(notice)), notice];
}

export function removeKey(notices: Notice[], key: string): Notice[] {
  return notices.filter((n) => noticeKey(n) !== key);
}


/** How long `pick cleared · Kári moved that letter` stays: two seconds, like the live row's move notices. */
export const PICK_CLEARED_HOLD_MS = 2_000;

/** The opponent's move took a letter the viewer had picked (spec 050 FR-014). */
export function pickClearedNotice(byName: string, now: number): Notice {
  return { kind: "pickCleared", byName, expiresAt: now + PICK_CLEARED_HOLD_MS };
}

/** Drops the notices whose `expiresAt` has passed; a notice without one stays. */
export function expireNotices(notices: Notice[], now: number): Notice[] {
  return notices.filter((n) => {
    const expiresAt = (n as { expiresAt?: number }).expiresAt;
    return expiresAt === undefined || expiresAt > now;
  });
}
