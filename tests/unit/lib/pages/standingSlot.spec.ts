import { describe, expect, it } from "vitest";

import { standingSlot } from "@/lib/pages/standingSlot";
import type { LobbyRow, StandingFacts } from "@/lib/types/standing";

const KARI: LobbyRow = { playerId: "00000000-0000-4000-8000-000000000002", displayName: "Kári", handle: "kári", rating: 1179, state: "here", movesPlayed: null, record: { wins: 3, losses: 1, draws: 0 } };
const EMBLA: LobbyRow = { ...KARI, playerId: "00000000-0000-4000-8000-000000000003", displayName: "Embla", handle: "embla" };
const soon = () => new Date(Date.now() + 47_000).toISOString();

function facts(extra: Partial<StandingFacts> = {}): StandingFacts {
  return { now: new Date().toISOString(), topic: "player:x", lobbyLanguage: "is", incoming: [], outgoing: null, cooldowns: [], search: null, tableCooldownUntil: null, match: null, switchPending: null, notice: null, counts: { here: 0, searching: 0, playing: 0, otherHere: 0 }, viewer: { rating: 1200, gamesPlayed: 0 }, ...extra };
}
const call = (from: LobbyRow, n: number) => ({ inviteId: `00000000-0000-4000-8000-00000000010${n}`, from, expiresAt: soon() });
const pending = { inviteId: "00000000-0000-4000-8000-000000000201", to: EMBLA, status: "pending" as const, createdAt: new Date().toISOString(), expiresAt: soon(), respondedAt: null, matchId: null };
const running = { kind: "running" as const, matchId: "00000000-0000-4000-8000-000000000301", opponent: "Kári", movesPlayed: 3, moveLimit: 10, deadlineAt: soon() };
const searching = { kind: "searching" as const, elapsedSeconds: 7 };

/** Spec 070 FR-009, US4.2 (T075): the slot shows one standing state, by precedence. */
describe("standingSlot", () => {
  it("is empty with nothing standing", () => {
    expect(standingSlot({ facts: facts(), held: null, search: null })).toEqual({ kind: "empty" });
    expect(standingSlot({ facts: null, held: null, search: null })).toEqual({ kind: "empty" });
  });

  it("puts a call above everything, counting the others and saying if you are searching", () => {
    const slot = standingSlot({ facts: facts({ incoming: [call(KARI, 1), call(EMBLA, 2)], match: running, outgoing: pending }), held: null, search: searching });
    expect(slot).toMatchObject({ kind: "call", more: 1, searching: true, call: { from: { displayName: "Kári" } } });
  });

  it("puts your match above a lobby switch, your challenge and your search; a table is your match too", () => {
    expect(standingSlot({ facts: facts({ match: running, outgoing: pending, switchPending: { to: "en", from: "is", pending: ["search"] } }), held: null, search: searching }).kind).toBe("match");
    expect(standingSlot({ facts: facts({ match: { ...running, kind: "table" } }), held: null, search: null })).toMatchObject({ kind: "match", match: { kind: "table" } });
  });

  it("puts a lobby switch above your challenge and search", () => {
    expect(standingSlot({ facts: facts({ outgoing: pending, switchPending: { to: "en", from: "is", pending: ["outgoing"] } }), held: null, search: searching }).kind).toBe("switch");
  });

  it("shows your pending challenge, then its outcome for as long as it is held", () => {
    expect(standingSlot({ facts: facts({ outgoing: pending }), held: null, search: searching })).toMatchObject({ kind: "sent", outgoing: { status: "pending" }, held: null });
    const held = { inviteId: pending.inviteId, playerId: EMBLA.playerId, name: "Embla", outcome: "declined" as const };
    expect(standingSlot({ facts: facts({ outgoing: { ...pending, status: "declined", respondedAt: new Date().toISOString() } }), held, search: null })).toMatchObject({ kind: "sent", held });
    expect(standingSlot({ facts: facts({ outgoing: { ...pending, status: "declined", respondedAt: new Date().toISOString() } }), held: null, search: null }).kind).toBe("empty");
  });

  it("shows the search in each of its standing states, but not once found or cancelled", () => {
    for (const s of [searching, { kind: "paused" as const }, { kind: "stillSearching" as const, elapsedSeconds: 180, drain: 0.5 }, { kind: "stopped" as const }, { kind: "cooldown" as const, leftMs: 60_000 }]) {
      expect(standingSlot({ facts: facts(), held: null, search: s }).kind).toBe("search");
    }
    expect(standingSlot({ facts: facts(), held: null, search: { kind: "cancelled" } }).kind).toBe("empty");
  });

  it("says once that you did not sit down, when nothing else stands", () => {
    expect(standingSlot({ facts: facts({ notice: "table_missed" }), held: null, search: null })).toEqual({ kind: "notice", notice: "table_missed" });
  });
});
