import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { pagePrimary } from "@/lib/pages/pagePrimary";
import type { SlotState } from "@/lib/pages/standingSlot";
import type { LobbyRow } from "@/lib/types/standing";

const EMBLA: LobbyRow = { playerId: "00000000-0000-4000-8000-000000000003", displayName: "Embla", handle: "embla", rating: 1342, state: "here", movesPlayed: null, record: null };
const soon = new Date(Date.now() + 50_000).toISOString();
const en = getCopy("en");
const idle = { composing: false };

/** Spec 070 T077: slip > call > composer send > page primary; a wait has none. */
describe("pagePrimary", () => {
  it("is find an opponent when nothing stands", () => {
    expect(pagePrimary({ kind: "empty" }, en, idle)).toEqual({ find: "primary", note: null });
  });

  it("steps down under a call, and while a composer is open", () => {
    expect(pagePrimary({ kind: "call", call: { inviteId: "i", from: EMBLA, expiresAt: soon }, more: 0, searching: false }, en, idle).find).toBe("secondary");
    expect(pagePrimary({ kind: "empty" }, en, { composing: true }).find).toBe("secondary");
  });

  it("is gone during your match, with the reason", () => {
    const slot: SlotState = { kind: "match", match: { kind: "running", matchId: "m", opponent: "Kári", movesPlayed: 3, moveLimit: 10, deadlineAt: soon } };
    expect(pagePrimary(slot, en, idle)).toEqual({ find: "hidden", note: "finish your match first" });
  });

  it("is a secondary that says it withdraws your challenge while one is out", () => {
    const slot: SlotState = { kind: "sent", outgoing: { inviteId: "i", to: EMBLA, status: "pending", createdAt: soon, expiresAt: soon, respondedAt: null, matchId: null }, held: null };
    expect(pagePrimary(slot, en, idle)).toEqual({ find: "secondary", note: "withdraws your challenge" });
  });

  it("is not drawn while you search: the search is in the slot", () => {
    expect(pagePrimary({ kind: "search", search: { kind: "searching", elapsedSeconds: 7 } }, en, idle).find).toBe("hidden");
  });
});
