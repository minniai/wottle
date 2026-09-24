import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { phoneSlotHeight, slotLines, type SlotContext } from "@/lib/pages/slotLines";
import type { SlotState } from "@/lib/pages/standingSlot";
import type { LobbyRow } from "@/lib/types/standing";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const KARI: LobbyRow = { playerId: "00000000-0000-4000-8000-000000000002", displayName: "Kári", handle: "kári", rating: 1179, state: "here", movesPlayed: null, record: { wins: 3, losses: 1, draws: 0 } };
const EMBLA: LobbyRow = { ...KARI, playerId: "00000000-0000-4000-8000-000000000003", displayName: "Embla", rating: 1342, record: null };
const ctx = (extra: Partial<SlotContext> = {}): SlotContext => ({ nowMs: NOW, phone: false, viewer: { rating: 1310, gamesPlayed: 22 }, searchingCount: 2, ...extra });
const en = getCopy("en");
const is = getCopy("is");

/** Spec 070 T076: the slot's exact strings in both languages, its actions and its bar. */
describe("slotLines", () => {
  it("writes a call with the record and the time to answer, accept primary, and a 60s drain", () => {
    const slot: SlotState = { kind: "call", call: { inviteId: "i", from: KARI, expiresAt: at(47_000) }, more: 0, searching: false };
    // The rating names its language (US7.5): the call can reach a page in the other locale.
    const m = slotLines(slot, is, ctx({ languageName: "íslenska" }));
    expect(m).toMatchObject({ style: "call", square: "opp", line1: "Kári skorar á þig", line2: "1179 íslenska · þinn ferill 3–1 · 0:47 til að svara" });
    expect(m.primary).toEqual({ label: "samþykkja ▸", action: "accept" });
    expect(m.secondaries).toEqual([{ label: "hafna", action: "decline" }]);
    expect(m.bar).toEqual({ kind: "drain", fraction: 47 / 60 });
    expect(slotLines(slot, is, ctx({ phone: true, languageName: "íslenska" })).line2).toBe("1179 íslenska · 3–1 · 0:47 til að svara");
  });

  it("leaves the record out when there is none, and adds +1 and the search consequence", () => {
    const slot: SlotState = { kind: "call", call: { inviteId: "i", from: EMBLA, expiresAt: at(30_000) }, more: 1, searching: true };
    expect(slotLines(slot, en, ctx({ languageName: "english" })).line2).toBe("1342 english · 0:30 to answer · +1 · accepting cancels your search");
  });

  it("writes your running match, the table, and the match that ended while you were away", () => {
    const running: SlotState = { kind: "match", match: { kind: "running", matchId: "m", opponent: "Kári", movesPlayed: 3, moveLimit: 10, deadlineAt: at(192_000) } };
    expect(slotLines(running, is, ctx())).toMatchObject({ style: "status", line1: "Viðureignin þín · Kári", line2: "leikur 4 af 10 · 3:12 eftir", primary: { label: "aftur í viðureignina ▸", action: "backToMatch" } });
    const table: SlotState = { kind: "match", match: { kind: "table", matchId: "m", opponent: "Kári", movesPlayed: 0, moveLimit: 10, deadlineAt: null } };
    expect(slotLines(table, en, ctx()).line2).toBe("opponent found");
    const over: SlotState = { kind: "match", match: { kind: "over", matchId: "m", opponent: "Kári", winner: "opponent", winnerName: "Kári", you: 46, them: 88, endedReason: "moves_complete" } };
    expect(slotLines(over, en, ctx())).toMatchObject({ line1: "Your match is over · Kári wins 88–46", primary: { action: "result" } });
  });

  it("writes your challenge with its time, terms and stakes; withdraw is a secondary; the bar drains", () => {
    const slot: SlotState = { kind: "sent", outgoing: { inviteId: "i", to: EMBLA, status: "pending", createdAt: at(-8_000), expiresAt: at(52_000), respondedAt: null, matchId: null }, held: null };
    const m = slotLines(slot, en, ctx());
    expect(m.line1).toBe("Challenge sent · Embla · 0:52");
    expect(m.line2).toMatch(/^english words · 10 moves each · win \+\d+ · loss −\d+$/);
    expect(m.primary).toBeNull();
    expect(m.secondaries).toEqual([{ label: "withdraw ▸", action: "withdraw" }]);
    expect(slotLines(slot, is, ctx({ phone: true }))).toMatchObject({ line1: "Embla · 0:52", line2: "áskorun send · haltu skjánum opnum" });
  });

  it("writes what became of your challenge while it is held", () => {
    const slot: SlotState = { kind: "sent", outgoing: null, held: { inviteId: "i", playerId: EMBLA.playerId, name: "Embla", outcome: "declined" } };
    expect(slotLines(slot, en, ctx())).toMatchObject({ line1: "Embla · declined", primary: null, secondaries: [] });
    expect(slotLines(slot, is, ctx()).line1).toBe("Embla · hafnaði");
  });

  it("writes your search, and after 0:30 alone says to challenge someone instead", () => {
    const at7: SlotState = { kind: "search", search: { kind: "searching", elapsedSeconds: 7 } };
    expect(slotLines(at7, en, ctx())).toMatchObject({ line1: "Searching for an opponent · 0:07", line2: "2 searching now · english words", secondaries: [{ label: "cancel ▸", action: "cancelSearch" }], bar: { kind: "sweep" } });
    const alone: SlotState = { kind: "search", search: { kind: "searching", elapsedSeconds: 31 } };
    expect(slotLines(alone, en, ctx({ searchingCount: 1 })).line2).toBe("no one else is searching · challenge someone below");
    expect(slotLines(at7, is, ctx({ phone: true }))).toMatchObject({ line1: "leitar · 0:07", line2: "haltu skjánum opnum" });
  });

  it("writes the search's pause, check, stop and cooldown (spec 069, now in the slot)", () => {
    expect(slotLines({ kind: "search", search: { kind: "paused" } }, en, ctx())).toMatchObject({ line1: "search paused", primary: { action: "resume" } });
    expect(slotLines({ kind: "search", search: { kind: "stillSearching", elapsedSeconds: 180, drain: 0.5 } }, en, ctx())).toMatchObject({ line1: "Still searching? · 3:00", primary: { action: "keepSearching" }, bar: { kind: "drain", fraction: 0.5 } });
    expect(slotLines({ kind: "search", search: { kind: "stopped" } }, en, ctx())).toMatchObject({ line1: "search stopped", primary: { action: "findAgain" } });
    expect(slotLines({ kind: "search", search: { kind: "cooldown", leftMs: 252_000 } }, en, ctx()).line1).toBe("find again in 4:12");
  });

  it("asks before a lobby switch cancels something", () => {
    const slot: SlotState = { kind: "switch", pending: { to: "en", from: "is", pending: ["search"] } };
    expect(slotLines(slot, en, ctx())).toMatchObject({ line1: "you are in the Icelandic lobby", line2: "switching cancels your search", primary: { label: "switch ▸", action: "switch" } });
  });

  it("is the terms when nothing stands", () => {
    expect(slotLines({ kind: "empty" }, en, ctx()).style).toBe("terms");
  });
});

describe("slotLines on a phone (spec 070 T112, SC-007)", () => {
  it("writes the result first and says the match is over beneath, so a long name fits", () => {
    const over: SlotState = { kind: "match", match: { kind: "over", matchId: "m", opponent: "Kári", winner: "opponent", winnerName: "Kári", you: 46, them: 88, endedReason: "moves_complete" } };
    expect(slotLines(over, en, ctx({ phone: true }))).toMatchObject({ line1: "Kári wins 88–46", line2: "your match is over" });
    expect(slotLines(over, is, ctx({ phone: true })).line2).toBe("viðureigninni er lokið");
  });

  it("gives the slot's actions their own row: the phone slot is taller whenever it has any", () => {
    const running: SlotState = { kind: "match", match: { kind: "running", matchId: "m", opponent: "Kári", movesPlayed: 3, moveLimit: 10, deadlineAt: at(192_000) } };
    expect(phoneSlotHeight(slotLines(running, en, ctx({ phone: true })))).toBe(104);
    expect(phoneSlotHeight({ ...slotLines(running, en, ctx({ phone: true })), primary: null, secondaries: [] })).toBe(64);
    expect(phoneSlotHeight({ ...slotLines(running, en, ctx({ phone: true })), style: "terms" })).toBe(0);
  });
});

describe("the sent challenge on a phone (SC-007)", () => {
  it("leads with the name and countdown; `challenge sent` moves to line 2", () => {
    const outgoing = { inviteId: "i", to: KARI, status: "pending" as const, createdAt: at(-8_000), expiresAt: at(52_000), respondedAt: null, matchId: null };
    const slot: SlotState = { kind: "sent", outgoing, held: null };
    expect(slotLines(slot, en, ctx({ phone: true }))).toMatchObject({ line1: "Kári · 0:52", line2: "challenge sent · keep this screen open" });
    expect(slotLines(slot, is, ctx({ phone: true }))).toMatchObject({ line1: "Kári · 0:52", line2: "áskorun send · haltu skjánum opnum" });
  });
});
