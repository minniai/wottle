import { describe, expect, it } from "vitest";

import { standingSlot } from "@/lib/pages/standingSlot";
import type { LinkCall, OutgoingLink } from "@/lib/types/link";
import type { LobbyRow, StandingFacts } from "@/lib/types/standing";

const KARI: LobbyRow = { playerId: "00000000-0000-4000-8000-000000000002", displayName: "Kári", handle: "kári", rating: 1179, state: "here", movesPlayed: null, record: null };
const soon = (ms = 598_000) => new Date(Date.now() + ms).toISOString();

function facts(extra: Partial<StandingFacts> = {}): StandingFacts {
  return { now: new Date().toISOString(), topic: "player:x", lobbyLanguage: "is", incoming: [], outgoing: null, cooldowns: [], search: null, tableCooldownUntil: null, match: null, switchPending: null, notice: null, counts: { here: 0, searching: 0, playing: 0, otherHere: 0 }, viewer: { rating: 1200, gamesPlayed: 0 }, ...extra };
}
const link: OutgoingLink = { id: "00000000-0000-4000-8000-000000000501", status: "pending", expiresAt: soon(), respondedAt: null };
const call = { inviteId: "00000000-0000-4000-8000-000000000101", from: KARI, expiresAt: soon(47_000) };
const pendingChallenge = { inviteId: "00000000-0000-4000-8000-000000000201", to: KARI, status: "pending" as const, createdAt: new Date().toISOString(), expiresAt: soon(47_000), respondedAt: null, matchId: null };
const running = { kind: "running" as const, matchId: "00000000-0000-4000-8000-000000000301", opponent: "Kári", movesPlayed: 3, moveLimit: 10, deadlineAt: soon() };
const linkCall: LinkCall = {
  token: "a".repeat(43),
  view: { valid: true, senderId: "00000000-0000-4000-8000-000000000009", senderName: "Hekla", senderHandle: "hekla", senderRating: 1250, language: "en", expiresAt: soon(552_000) },
};

/** Spec 072 T018, T042: the link's place in the slot's precedence. */
describe("standingSlot · links", () => {
  it("shows a pending link below a challenge and above a search", () => {
    expect(standingSlot({ facts: facts({ link }), held: null, search: { kind: "searching", elapsedSeconds: 3 } })).toMatchObject({ kind: "link", link, held: null });
    expect(standingSlot({ facts: facts({ link, outgoing: pendingChallenge }), held: null, search: null }).kind).toBe("sent");
  });

  it("gives a call, a match and a switch precedence over it", () => {
    expect(standingSlot({ facts: facts({ link, incoming: [call] }), held: null, search: null }).kind).toBe("call");
    expect(standingSlot({ facts: facts({ link, match: running }), held: null, search: null }).kind).toBe("match");
    expect(standingSlot({ facts: facts({ link, switchPending: { to: "en", from: "is", pending: ["link"] } }), held: null, search: null }).kind).toBe("switch");
  });

  it("holds a cancelled or expired link's outcome", () => {
    const ended = { ...link, status: "expired" as const, respondedAt: new Date().toISOString() };
    expect(standingSlot({ facts: facts({ link: ended }), held: null, search: null, link: { held: "expired" } })).toMatchObject({ kind: "link", held: "expired" });
    expect(standingSlot({ facts: facts({ link: ended }), held: null, search: null }).kind).toBe("empty");
  });

  it("shows the sender's own link, opened, when nothing else stands", () => {
    expect(standingSlot({ facts: facts(), held: null, search: null, link: { own: linkCall } })).toMatchObject({ kind: "link", link: null, own: linkCall });
    expect(standingSlot({ facts: facts({ link }), held: null, search: null, link: { own: linkCall } })).toMatchObject({ kind: "link", link });
  });

  it("puts a link call among the calls, after challenges, counting it", () => {
    expect(standingSlot({ facts: facts({ link }), held: null, search: null, link: { call: linkCall } })).toMatchObject({ kind: "linkCall", call: linkCall, more: 0 });
    expect(standingSlot({ facts: facts({ incoming: [call] }), held: null, search: null, link: { call: linkCall } })).toMatchObject({ kind: "call", more: 1 });
    expect(standingSlot({ facts: facts({ match: running }), held: null, search: null, link: { call: linkCall } }).kind).toBe("linkCall");
  });

  it("drops a link call at its expiry", () => {
    const past = { ...linkCall, view: { ...linkCall.view, expiresAt: new Date(Date.now() - 1000).toISOString() } };
    expect(standingSlot({ facts: facts(), held: null, search: null, link: { call: past } }).kind).toBe("empty");
  });
});
