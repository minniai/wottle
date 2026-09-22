import type { Copy } from "@/lib/i18n/copy/types";
import type { OutgoingChallenge } from "./ledgerTypes";
import type { Notice } from "./ledgerTypes";

/** Text for a notice line (design system §8). Notices with actions render their own controls. */
export function noticeText(notice: Notice, copy: Copy): string {
  switch (notice.kind) {
    case "pickCleared":
      return copy.pickClearedMoved(notice.byName);
    case "rematchRequest":
      return copy.rematchRequest(notice.requesterName);
    case "challenge":
      return copy.challengeNotice(notice.fromName);
    case "challengeSent":
      return copy.challengeSent(notice.toName);
    case "text":
      return notice.text;
  }
}

/**
 * A notice's identity: its kind, except a challenge, which is its invite, so
 * two challengers each keep their own line and one never hides the other.
 */
export function noticeKey(notice: Notice): string {
  return notice.kind === "challenge" ? `challenge:${notice.inviteId}` : notice.kind;
}

/** Notices replace their own key, so a repeated line never stacks. */
export function addNotice(notices: Notice[], notice: Notice): Notice[] {
  return [...removeKey(notices, noticeKey(notice)), notice];
}

export function removeKey(notices: Notice[], key: string): Notice[] {
  return notices.filter((n) => noticeKey(n) !== key);
}


/** No notice kind carries an expiry since the resign confirmation became a slip (spec 048 US7); kept for a future timed line. */
export function expireNotices(notices: Notice[], now: number): Notice[] {
  return notices.filter((n) => {
    const expiresAt = (n as { expiresAt?: number }).expiresAt;
    return expiresAt === undefined || expiresAt > now;
  });
}

type Challenge = Extract<Notice, { kind: "challenge" }>;

/**
 * The challenge lines are the pending challenges, oldest first: a new one is
 * added, one no longer pending (answered, expired) leaves. Unchanged, the same
 * list comes back, so a poll that brings nothing new renders nothing.
 */
export function syncChallenges(notices: Notice[], pending: Challenge[]): Notice[] {
  const ids = new Set(pending.map((c) => c.inviteId));
  const kept = notices.filter((n) => n.kind !== "challenge" || ids.has(n.inviteId));
  const shown = new Set(kept.flatMap((n) => (n.kind === "challenge" ? [n.inviteId] : [])));
  const added = pending.filter((c) => !shown.has(c.inviteId));
  return kept.length === notices.length && added.length === 0 ? notices : [...kept, ...added];
}

/** The line that replaces `challenge sent · waiting for Kári` once it is answered; accepted opens the match instead. */
export function challengeOutcome(outgoing: OutgoingChallenge, copy: Copy): string | null {
  switch (outgoing.status) {
    case "expired":
      return copy.challengeUnanswered(outgoing.recipientName);
    case "declined":
      return outgoing.recipientInMatch ? copy.challengeTaken(outgoing.recipientName) : copy.challengeDeclined(outgoing.recipientName);
    default:
      return null;
  }
}
