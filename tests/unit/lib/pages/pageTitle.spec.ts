import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { pageTitle } from "@/lib/pages/pageTitle";
import type { LobbyRow } from "@/lib/types/standing";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const KARI: LobbyRow = { playerId: "00000000-0000-4000-8000-000000000002", displayName: "Kári", handle: "kári", rating: 1179, state: "here", movesPlayed: null, record: null };
const ctx = { nowMs: NOW, calls: 1, arrival: null };

/** Spec 070 FR-011, §7.7 (T078): the tab title follows the beat. */
describe("pageTitle", () => {
  it("names a call, counting them", () => {
    const slot = { kind: "call" as const, call: { inviteId: "i", from: KARI, expiresAt: at(47_000) }, more: 1, searching: false };
    expect(pageTitle(slot, getCopy("is"), { ...ctx, calls: 2 })).toBe("(2) Kári skorar á þig · Orðusta");
    expect(pageTitle(slot, getCopy("en"), ctx)).toBe("(1) Kári challenges you · Wottle");
  });

  it("counts a sent challenge and a search", () => {
    const sent = { kind: "sent" as const, outgoing: { inviteId: "i", to: KARI, status: "pending" as const, createdAt: at(0), expiresAt: at(41_000), respondedAt: null, matchId: null }, held: null };
    expect(pageTitle(sent, getCopy("en"), ctx)).toBe("challenge sent · 0:41 · Wottle");
    expect(pageTitle({ kind: "search", search: { kind: "searching", elapsedSeconds: 7 } }, getCopy("en"), ctx)).toBe("searching 0:07 · Wottle");
  });

  it("names your running match, the table, and the result of one that ended away", () => {
    expect(pageTitle({ kind: "match", match: { kind: "running", matchId: "m", opponent: "Kári", movesPlayed: 3, moveLimit: 10, deadlineAt: at(192_000) } }, getCopy("en"), ctx)).toBe("your match · 3:12 · Wottle");
    expect(pageTitle({ kind: "match", match: { kind: "over", matchId: "m", opponent: "Kári", winner: "opponent", winnerName: "Kári", you: 46, them: 88, endedReason: null } }, getCopy("en"), ctx)).toBe("Kári wins 88–46 · Wottle");
  });

  it("says who arrived when you asked to be told, and leaves the page's own title otherwise", () => {
    expect(pageTitle({ kind: "empty" }, getCopy("en"), { ...ctx, arrival: "Embla" })).toBe("Embla is here · Wottle");
    expect(pageTitle({ kind: "empty" }, getCopy("en"), ctx)).toBeNull();
  });
});
