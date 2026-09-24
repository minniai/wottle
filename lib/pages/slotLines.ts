import type { Copy } from "@/lib/i18n/copy/types";
import { CHALLENGE_TTL_MS } from "@/lib/presence/constants";
import { stakesFor } from "@/lib/rating/stakes";
import { formatClock } from "@/lib/room/clock";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import type { MatchmakingState } from "@/lib/room/useMatchmaking";
import type { MatchFact } from "@/lib/types/standing";

import { recordText } from "./lobbyRows";
import type { SlotState } from "./standingSlot";

export type SlotAction = "accept" | "decline" | "withdraw" | "cancelSearch" | "resume" | "keepSearching" | "findAgain" | "backToMatch" | "result" | "switch";

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
    return status(copy.pages.overLine1(verdict), detail, { primary: { label: copy.RESULT, action: "result" } });
  }
  const line2 = match.kind === "table" ? copy.pages.TABLE_LINE2 : copy.pages.matchLine2(Math.min(match.movesPlayed + 1, match.moveLimit), match.moveLimit, formatClock(match.deadlineAt ? left(match.deadlineAt, ctx.nowMs) : 0));
  return status(copy.pages.matchLine1(match.opponent), line2, { primary: { label: copy.pages.BACK_TO_MATCH, action: "backToMatch" } });
}

function sentModel(slot: Extract<SlotState, { kind: "sent" }>, copy: Copy, ctx: SlotContext): SlotModel {
  if (slot.held) return status(copy.pages.outcomeAnnounce(slot.held.name, copy.pages.OUTCOMES[slot.held.outcome]), "");
  const out = slot.outgoing!;
  const ms = left(out.expiresAt, ctx.nowMs);
  const stakes = stakesFor({ eloRating: ctx.viewer.rating, gamesPlayed: ctx.viewer.gamesPlayed, wins: 0, losses: 0, draws: 0 }, { eloRating: out.to.rating, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });
  const line1 = (ctx.phone ? copy.pages.sentPhone : copy.pages.sentLine1)(out.to.displayName, formatClock(ms));
  const line2 = ctx.phone ? copy.pages.KEEP_SCREEN_OPEN : copy.pages.sentLine2(copy.LANGUAGE_WORDS, TOTAL_MOVES, stakes.win, stakes.loss);
  return status(line1, line2, { secondaries: [{ label: copy.pages.WITHDRAW, action: "withdraw" }], bar: { kind: "drain", fraction: clamp(ms / CHALLENGE_TTL_MS) } });
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
