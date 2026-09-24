import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { composerModel } from "@/lib/pages/composer";
import { lobbyPrimary, pagePrimary } from "@/lib/pages/pagePrimary";
import type { SlotState } from "@/lib/pages/standingSlot";

const link = { id: "00000000-0000-4000-8000-000000000501", status: "pending" as const, expiresAt: new Date(Date.now() + 600_000).toISOString(), respondedAt: null };

/** Spec 072 T020: invite a friend ▸ in the lobby, and what a link does to find and send. */
describe("lobbyPrimary", () => {
  it("makes invite a friend the primary of an empty lobby, with find a secondary", () => {
    expect(lobbyPrimary({ othersHere: 0, find: { find: "primary", note: null }, copy: copyEn })).toEqual({
      invite: "primary",
      find: { find: "secondary", note: null },
      inviteNote: null,
    });
  });

  it("keeps find the primary with others here, invite a secondary with its note", () => {
    expect(lobbyPrimary({ othersHere: 3, find: { find: "primary", note: null }, copy: copyEn })).toEqual({
      invite: "secondary",
      find: { find: "primary", note: null },
      inviteNote: "a link that works for 10 minutes",
    });
  });

  it("never raises invite over a slot that holds find down", () => {
    expect(lobbyPrimary({ othersHere: 0, find: { find: "hidden", note: "finish your match first" }, copy: copyEn }).invite).toBe("hidden");
    expect(lobbyPrimary({ othersHere: 0, find: { find: "secondary", note: null }, copy: copyEn }).invite).toBe("secondary");
  });
});

describe("pagePrimary · links", () => {
  it("steps find down while a link is out, saying it would cancel the link", () => {
    const slot: SlotState = { kind: "link", link, held: null, own: null };
    expect(pagePrimary(slot, copyEn, { composing: false })).toEqual({ find: "secondary", note: "finding cancels your link" });
  });

  it("lets a link call's accept be the primary", () => {
    const slot = { kind: "linkCall", call: { token: "t", view: {} }, more: 0 } as unknown as SlotState;
    expect(pagePrimary(slot, copyEn, { composing: false }).find).toBe("secondary");
  });
});

describe("composerModel · links", () => {
  it("says sending cancels the link", () => {
    const m = composerModel({ viewer: { rating: 1310, gamesPlayed: 12 }, opponent: { rating: 1342 }, searching: false, outgoing: false, callUp: false, link: true }, copyEn, "desktop");
    expect(m.consequence).toBe("sending cancels your link");
  });
});
