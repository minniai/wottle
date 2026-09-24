import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { challengesClosed, rowOverlays } from "@/lib/pages/rowOverlays";
import type { LobbyRow, StandingFacts } from "@/lib/types/standing";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const row = (n: number, name: string): LobbyRow => ({ playerId: `00000000-0000-4000-8000-00000000000${n}`, displayName: name, handle: name.toLowerCase(), rating: 1250, state: "here", movesPlayed: null, record: null });
const [KARI, HEKLA, EMBLA] = [row(1, "Kári"), row(2, "Hekla"), row(3, "Embla")];
const facts = (extra: Partial<StandingFacts>): StandingFacts => ({
  now: at(0), topic: "player:x", lobbyLanguage: "en", incoming: [], outgoing: null, cooldowns: [], search: null, tableCooldownUntil: null, match: null, switchPending: null, notice: null,
  counts: { here: 5, searching: 2, playing: 1, otherHere: 12 }, viewer: { rating: 1310, gamesPlayed: 22 }, ...extra,
});
const en = getCopy("en");

/** Spec 070 US3–US4: the rows carry the standing (LobbySent: Kári sent, Hekla declined). */
describe("rowOverlays", () => {
  it("writes sent with its time on the challenged row, with no action", () => {
    const m = rowOverlays(facts({ outgoing: { inviteId: "i", to: KARI, status: "pending", createdAt: at(-8_000), expiresAt: at(52_000), respondedAt: null, matchId: null } }), null, NOW, en);
    expect(m.get(KARI.playerId)).toEqual({ status: "sent · 0:52", action: "none" });
  });

  it("counts a declined pair's cooldown and shows the held outcome on its row", () => {
    const m = rowOverlays(facts({ cooldowns: [{ playerId: HEKLA.playerId, until: at(41_000) }] }), { inviteId: "i", playerId: HEKLA.playerId, name: "Hekla", outcome: "declined" }, NOW, en);
    expect(m.get(HEKLA.playerId)).toEqual({ status: "declined", action: { againUntilMs: NOW + 41_000 } });
  });

  it("marks a caller's row: challenges you, no action", () => {
    const m = rowOverlays(facts({ incoming: [{ inviteId: "i", from: EMBLA, expiresAt: at(47_000) }] }), null, NOW, en);
    expect(m.get(EMBLA.playerId)).toEqual({ status: "challenges you", action: "none" });
  });
});

describe("challengesClosed", () => {
  it("is closed at a table or in a running match, open after it ends", () => {
    expect(challengesClosed(facts({ match: { kind: "table", matchId: "m", opponent: "K", movesPlayed: 0, moveLimit: 10, deadlineAt: null } }))).toBe(true);
    expect(challengesClosed(facts({ match: { kind: "over", matchId: "m", opponent: "K", winner: "you", winnerName: "B", you: 1, them: 0, endedReason: null } }))).toBe(false);
    expect(challengesClosed(null)).toBe(false);
  });
});
