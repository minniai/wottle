import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { slotLines, type SlotContext } from "@/lib/pages/slotLines";
import type { SlotState } from "@/lib/pages/standingSlot";
import type { LinkCall, OutgoingLink } from "@/lib/types/link";

const NOW = Date.parse("2026-09-24T12:00:00Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const link: OutgoingLink = { id: "00000000-0000-4000-8000-000000000501", status: "pending", expiresAt: at(598_000), respondedAt: null };
const ctx = (extra: Partial<SlotContext> = {}): SlotContext => ({ nowMs: NOW, phone: false, viewer: { rating: 1310, gamesPlayed: 12 }, searchingCount: 0, ...extra });
const stored = { linkId: link.id, url: "https://wottle.test/en/c/abc" };
const linkCall: LinkCall = {
  token: "a".repeat(43),
  view: { valid: true, senderId: "00000000-0000-4000-8000-000000000009", senderName: "Hekla", senderHandle: "hekla", senderRating: 1250, language: "en", expiresAt: at(552_000) },
};
const slot = (extra: Partial<Extract<SlotState, { kind: "link" }>> = {}): SlotState => ({ kind: "link", link, held: null, own: null, ...extra });

/** Spec 072 T019: the link's lines, in both languages (contracts/page-derivations.md). */
describe("slotLines · links", () => {
  it("reads a copied link with its countdown, copy again and cancel, and a 10:00 drain", () => {
    const m = slotLines(slot(), copyEn, ctx({ linkText: stored }));
    expect(m).toMatchObject({ style: "status", square: "you", line1: "Link copied · valid 9:58", line2: "", primary: null });
    expect(m.secondaries.map((b) => b.action)).toEqual(["copyLink", "cancelLink"]);
    expect(m.secondaries.map((b) => b.label)).toEqual(["copy again ▸", "cancel link ▸"]);
    expect(m.bar).toEqual({ kind: "drain", fraction: 598 / 600 });
    expect(slotLines(slot(), copyIs, ctx({ linkText: stored })).line1).toBe("Tengill afritaður · gildir í 9:58");
  });

  it("offers a new link where this browser has not kept the link's text", () => {
    const m = slotLines(slot(), copyEn, ctx({ linkText: { ...stored, linkId: "other" } }));
    expect(m.line1).toBe("Link out · valid 9:58");
    expect(m.secondaries.map((b) => b.action)).toEqual(["newLink", "cancelLink"]);
    expect(slotLines(slot(), copyEn, ctx()).secondaries[0].action).toBe("newLink");
  });

  it("shows the link as text when the clipboard was refused", () => {
    const m = slotLines(slot(), copyEn, ctx({ linkText: stored, clipboardRefused: true }));
    expect(m.line1).toBe("Link ready · valid 9:58");
    expect(m.line2).toBe(stored.url);
    expect(m.secondaries.map((b) => b.action)).toEqual(["cancelLink"]);
  });

  it("holds a cancelled or expired link for its outcome", () => {
    expect(slotLines(slot({ held: "cancelled" }), copyEn, ctx()).line1).toBe("link cancelled");
    expect(slotLines(slot({ held: "expired" }), copyIs, ctx())).toMatchObject({ line1: "tengillinn rann út", secondaries: [], bar: null });
  });

  it("on a phone, the link call's line 2 drops the language words so it fits (SC-007)", () => {
    const call: SlotState = { kind: "linkCall", call: linkCall, more: 0 } as SlotState;
    expect(slotLines(call, copyIs, ctx({ phone: true }))).toMatchObject({ line1: "Hekla skorar á þig", line2: "1250 · tengill gildir í 9:12" });
    expect(slotLines(call, copyEn, ctx({ phone: true })).line2).toBe("1250 · link valid 9:12");
    expect(slotLines(call, copyIs, ctx()).line2).toBe("1250 · íslensk orð · tengill gildir í 9:12");
  });

  it("tells the sender their own link, with copy", () => {
    const m = slotLines(slot({ link: null, own: linkCall }), copyEn, ctx());
    expect(m).toMatchObject({ line1: "this is your link", line2: "valid 9:12" });
    expect(m.secondaries).toEqual([{ label: "copy ▸", action: "copyOwnLink" }]);
  });

  it("offers to cancel the sender's own link when it is the pending one", () => {
    const m = slotLines(slot({ own: linkCall }), copyEn, ctx());
    expect(m.line1).toBe("this is your link");
    expect(m.secondaries.map((b) => b.action)).toEqual(["copyOwnLink", "cancelLink"]);
  });

  it("calls a signed-in player to a link, with accept as the primary", () => {
    const m = slotLines({ kind: "linkCall", call: linkCall, more: 0 }, copyEn, ctx({ languageName: undefined }));
    expect(m).toMatchObject({ style: "call", square: "opp", line1: "Hekla invites you by link", line2: "1250 · english words · link valid 9:12" });
    expect(m.primary).toEqual({ label: copyEn.ACCEPT, action: "acceptLink" });
    expect(m.secondaries.map((b) => b.action)).toEqual(["dismissLink"]);
    expect(m.bar).toEqual({ kind: "drain", fraction: 552 / 600 });
    expect(slotLines({ kind: "linkCall", call: linkCall, more: 1 }, copyIs, ctx()).line2).toBe("1250 · íslensk orð · tengill gildir í 9:12 · +1");
  });
});
