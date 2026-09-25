import type { Copy } from "@/lib/i18n/copy/types";
import { LINK_TTL_MS } from "@/lib/constants/links";
import { CHALLENGE_TTL_MS } from "@/lib/presence/constants";
import { stakesFor } from "@/lib/rating/stakes";
import { formatClock } from "@/lib/room/clock";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import type { MatchmakingState } from "@/lib/room/useMatchmaking";
import type { MatchFact } from "@/lib/types/standing";

import { recordText } from "./lobbyRows";
import type { SlotState } from "./standingSlot";

export type SlotAction =
  | "accept"
  | "decline"
  | "withdraw"
  | "cancelSearch"
  | "resume"
  | "keepSearching"
  | "findAgain"
  | "backToMatch"
  | "result"
  | "switch"
  | "copyLink"
  | "newLink"
  | "cancelLink"
  | "copyOwnLink"
  | "acceptLink"
  | "dismissLink";

export interface SlotButton {
  label: string;
  action: SlotAction;
}

export interface SlotModel {
  /** `call`: addressed to you (tint, ink rule, their square); `status`: your own standing; `terms`: nothing stands. */
  style: "call" | "status" | "terms";
  square: "you" | "opp" | null;
  line1: string;
  line2: string;
  primary: SlotButton | null;
  secondaries: SlotButton[];
  bar: { kind: "drain"; fraction: number } | { kind: "sweep" } | null;
  /** Spec 072: line 2 is a link to select and copy by hand (the clipboard refused it). */
  line2IsUrl?: boolean;
}

export interface SlotContext {
  nowMs: number;
  phone: boolean;
  /** For the stakes on a sent challenge. */
  viewer: { rating: number; gamesPlayed: number };
  /** How many search in this lobby, for the search's line 2. */
  searchingCount: number;
  /** The lobby's language, named beside a rating (US7.5): a call can reach a page in the other locale. */
  languageName?: string;
  /** Spec 072: the link text this browser kept (research R2), and whether the clipboard refused it. */
  linkText?: { linkId: string; url: string } | null;
  clipboardRefused?: boolean;
}

const ALONE_AFTER_S = 30;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const left = (untilIso: string, nowMs: number) => Math.max(0, Date.parse(untilIso) - nowMs);

function status(line1: string, line2: string, extra: Partial<SlotModel> = {}): SlotModel {
  return { style: "status", square: "you", line1, line2, primary: null, secondaries: [], bar: null, ...extra };
}

function callModel(slot: Extract<SlotState, { kind: "call" }>, copy: Copy, ctx: SlotContext): SlotModel {
  const { from, expiresAt } = slot.call;
  const ms = left(expiresAt, ctx.nowMs);
  const record = from.record && recordText(from.record) !== "—" ? recordText(from.record) : null;
  const rating = ctx.languageName ? `${from.rating} ${ctx.languageName}` : String(from.rating);
  const base = (ctx.phone ? copy.pages.callLine2Phone : copy.pages.callLine2)(rating, record, formatClock(ms));
  const line2 = [base, slot.more > 0 ? `+${slot.more}` : null, slot.searching ? copy.pages.ACCEPTING_CANCELS_SEARCH : null].filter(Boolean).join(" · ");
  return {
    style: "call",
    square: "opp",
    line1: copy.pages.callLine1(from.displayName),
    line2,
    primary: { label: copy.ACCEPT, action: "accept" },
    secondaries: [{ label: copy.DECLINE, action: "decline" }],
    bar: { kind: "drain", fraction: clamp(ms / CHALLENGE_TTL_MS) },
  };
}

function matchModel(match: MatchFact, copy: Copy, ctx: SlotContext): SlotModel {
  if (match.kind === "over") {
    const verdict = match.winner === "draw" || !match.winnerName ? copy.drawLine(match.you, match.them) : copy.verdictLine(match.winnerName, Math.max(match.you, match.them), Math.min(match.you, match.them));
    const detail = match.winner === "draw" ? "" : copy.marginDetail(Math.abs(match.you - match.them));
    const result = { primary: { label: copy.RESULT, action: "result" as const } };
    // A phone has no room for a 24-character name and the rest: who won leads, the score follows (SC-007).
    if (ctx.phone) return status(phoneVerdict(match, copy), copy.pages.overPhoneLine2(copy.scoreSpan(Math.max(match.you, match.them), Math.min(match.you, match.them))), result);
    return status(copy.pages.overLine1(verdict), detail, result);
  }
  const line2 = match.kind === "table" ? copy.pages.TABLE_LINE2 : copy.pages.matchLine2(Math.min(match.movesPlayed + 1, match.moveLimit), match.moveLimit, formatClock(match.deadlineAt ? left(match.deadlineAt, ctx.nowMs) : 0));
  const back = { primary: { label: copy.pages.BACK_TO_MATCH, action: "backToMatch" as const } };
  // On a phone the name stands alone: `back to the match ▸` beneath says whose match it is (SC-007).
  if (ctx.phone) return status(match.opponent, line2, back);
  return status(copy.pages.matchLine1(match.opponent), line2, back);
}

function phoneVerdict(match: Extract<MatchFact, { kind: "over" }>, copy: Copy): string {
  return match.winner === "draw" || !match.winnerName ? copy.DRAW : copy.winsHeadline(match.winnerName);
}

function sentModel(slot: Extract<SlotState, { kind: "sent" }>, copy: Copy, ctx: SlotContext): SlotModel {
  if (slot.held) return status(copy.pages.outcomeAnnounce(slot.held.name, copy.pages.OUTCOMES[slot.held.outcome]), "");
  const out = slot.outgoing!;
  const ms = left(out.expiresAt, ctx.nowMs);
  const stakes = stakesFor({ eloRating: ctx.viewer.rating, gamesPlayed: ctx.viewer.gamesPlayed, wins: 0, losses: 0, draws: 0 }, { eloRating: out.to.rating, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });
  const line1 = (ctx.phone ? copy.pages.sentPhone : copy.pages.sentLine1)(out.to.displayName, formatClock(ms));
  const line2 = ctx.phone ? copy.pages.SENT_PHONE_LINE2 : copy.pages.sentLine2(copy.LANGUAGE_WORDS, TOTAL_MOVES, stakes.win, stakes.loss);
  return status(line1, line2, { secondaries: [{ label: copy.pages.WITHDRAW, action: "withdraw" }], bar: { kind: "drain", fraction: clamp(ms / CHALLENGE_TTL_MS) } });
}

function linkModel(slot: Extract<SlotState, { kind: "link" }>, copy: Copy, ctx: SlotContext): SlotModel {
  if (slot.held) return status(copy.pages.LINK_OUTCOMES[slot.held], "");
  if (slot.own) {
    const ms = left(slot.own.view.expiresAt, ctx.nowMs);
    const cancel: SlotButton[] = slot.link ? [{ label: copy.pages.CANCEL_LINK, action: "cancelLink" }] : [];
    return status(copy.pages.OWN_LINK, copy.pages.ownLinkLine2(formatClock(ms)), { secondaries: [{ label: copy.pages.COPY, action: "copyOwnLink" }, ...cancel] });
  }
  const link = slot.link!;
  const ms = left(link.expiresAt, ctx.nowMs);
  const clock = formatClock(ms);
  const bar = { kind: "drain" as const, fraction: clamp(ms / LINK_TTL_MS) };
  const cancel: SlotButton = { label: copy.pages.CANCEL_LINK, action: "cancelLink" };
  const kept = ctx.linkText?.linkId === link.id ? ctx.linkText : null;
  if (kept && ctx.clipboardRefused) return status(copy.pages.linkReady(clock), kept.url, { secondaries: [cancel], bar, line2IsUrl: true });
  if (kept) return status(copy.pages.linkCopied(clock), "", { secondaries: [{ label: copy.pages.COPY_AGAIN, action: "copyLink" }, cancel], bar });
  return status(copy.pages.linkOut(clock), "", { secondaries: [{ label: copy.pages.NEW_LINK, action: "newLink" }, cancel], bar });
}

function linkCallModel(slot: Extract<SlotState, { kind: "linkCall" }>, copy: Copy, ctx: SlotContext): SlotModel {
  const { view } = slot.call;
  const ms = left(view.expiresAt, ctx.nowMs);
  const rating = String(view.senderRating);
  // A phone has no room for the language words beside the time (SC-007), as with a challenge.
  const base = ctx.phone ? copy.pages.linkCallLine2Phone(rating, formatClock(ms)) : copy.pages.linkCallLine2(rating, copy.LANGUAGE_WORDS, formatClock(ms));
  const line2 = [base, slot.more > 0 ? `+${slot.more}` : null].filter(Boolean).join(" · ");
  return {
    style: "call",
    square: "opp",
    // A phone has no room for `invites you by link` beside a long name; the call reads as any call, the link on line 2.
    line1: (ctx.phone ? copy.pages.callLine1 : copy.pages.linkCallLine1)(view.senderName),
    line2,
    primary: { label: copy.ACCEPT, action: "acceptLink" },
    secondaries: [{ label: copy.pages.NOT_NOW, action: "dismissLink" }],
    bar: { kind: "drain", fraction: clamp(ms / LINK_TTL_MS) },
  };
}

function searchModel(search: MatchmakingState, copy: Copy, ctx: SlotContext): SlotModel {
  const cancel: SlotButton = { label: copy.CANCEL, action: "cancelSearch" };
  switch (search.kind) {
    case "searching": {
      const elapsed = formatClock(search.elapsedSeconds * 1000);
      if (ctx.phone) return status(copy.pages.searchPhone(elapsed), copy.pages.KEEP_SCREEN_OPEN, { secondaries: [cancel], bar: { kind: "sweep" } });
      const alone = search.elapsedSeconds >= ALONE_AFTER_S && ctx.searchingCount <= 1;
      const line2 = alone ? copy.pages.SEARCH_ALONE : copy.pages.searchLine2(ctx.searchingCount, copy.LANGUAGE_WORDS);
      return status(copy.pages.searchLine1(elapsed), line2, { secondaries: [cancel], bar: { kind: "sweep" } });
    }
    case "paused":
      return status(copy.table.SEARCH_PAUSED, "", { primary: { label: copy.table.RESUME, action: "resume" }, secondaries: [cancel] });
    case "stillSearching":
      return status(copy.table.stillSearching(formatClock(search.elapsedSeconds * 1000)), "", {
        primary: { label: copy.table.KEEP_SEARCHING, action: "keepSearching" },
        secondaries: [cancel],
        bar: { kind: "drain", fraction: clamp(search.drain) },
      });
    case "stopped":
      return status(copy.table.SEARCH_STOPPED, "", { primary: { label: copy.table.FIND_AGAIN, action: "findAgain" } });
    case "cooldown":
      return status(copy.table.findAgainIn(formatClock(search.leftMs)), copy.errors.table_cooldown);
    default:
      return terms(copy);
  }
}

function terms(copy: Copy): SlotModel {
  return { style: "terms", square: null, line1: "", line2: "", primary: null, secondaries: [], bar: null };
}

/** The line slot's words, actions and bar for its one standing state (contracts/page-derivations.md). */
export function slotLines(slot: SlotState, copy: Copy, ctx: SlotContext): SlotModel {
  switch (slot.kind) {
    case "call":
      return callModel(slot, copy, ctx);
    case "linkCall":
      return linkCallModel(slot, copy, ctx);
    case "link":
      return linkModel(slot, copy, ctx);
    case "match":
      return matchModel(slot.match, copy, ctx);
    case "switch": {
      const from = slot.pending.from === "is" ? copy.pages.LOBBY_NAME_IS : copy.pages.LOBBY_NAME_EN;
      return status(copy.pages.switchLine1(from), copy.pages.SWITCH_CONSEQUENCE[slot.pending.pending[0] ?? "search"], { primary: { label: copy.pages.SWITCH, action: "switch" } });
    }
    case "sent":
      return sentModel(slot, copy, ctx);
    case "search":
      return searchModel(slot.search, copy, ctx);
    case "notice":
      return status(copy.table.MISSED_NOTICE, "");
    case "empty":
      return terms(copy);
  }
}

/** Pixels the phone bottom slot takes: its actions have a row of their own, so any action makes it taller. */
export function phoneSlotHeight(model: SlotModel): number {
  if (model.style === "terms") return 0;
  return model.primary || model.secondaries.length > 0 ? 104 : 64;
}
