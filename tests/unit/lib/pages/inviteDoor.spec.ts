import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { inviteDoorModel } from "@/lib/pages/inviteDoor";
import type { LinkView } from "@/lib/types/link";

const NOW = Date.parse("2026-09-24T12:00:00Z");
const view = (extra: Partial<LinkView> = {}): LinkView => ({
  valid: true,
  senderId: "00000000-0000-4000-8000-000000000002",
  senderName: "Kári",
  senderHandle: "kári",
  senderRating: 1265,
  language: "en",
  expiresAt: new Date(NOW + 552_000).toISOString(),
  ...extra,
});

/** Spec 072 T031: the invite door's band, primary, secondary and consequence (A2). */
describe("inviteDoorModel", () => {
  it("names the sender, their rating, the language and the time left", () => {
    const m = inviteDoorModel(view(), NOW, copyEn);
    expect(m.band).toEqual({ line1: "Kári challenges you", line2: "1265 · english words · link valid 9:12", expired: false });
    expect(m.primary).toEqual({ label: "accept ▸", action: "accept" });
    expect(m.secondary).toEqual({ label: "enter the lobby instead", action: "enterLobby" });
    expect(m.consequence).toBe("Accepting signs you in with this name and seats you at Kári's table.");
  });

  it("reads in Icelandic", () => {
    const m = inviteDoorModel(view({ senderRating: 1187, language: "is" }), NOW, copyIs);
    expect(m.band.line1).toBe("Kári skorar á þig");
    expect(m.band.line2).toBe("1187 · íslensk orð · tengill gildir í 9:12");
    expect(m.primary.label).toBe("samþykkja ▸");
  });

  it("uses the returning player's own consequence", () => {
    expect(inviteDoorModel(view(), NOW, copyEn, "returning").consequence).toBe("Accepting seats you at Kári's table.");
  });

  it.each([
    ["an unknown link", null],
    ["a used, cancelled or expired link", view({ valid: false })],
    ["a link whose time ran out on the page", view({ expiresAt: new Date(NOW - 1).toISOString() })],
  ])("reads %s as expired, with enter the lobby as the primary", (_name, v) => {
    const m = inviteDoorModel(v, NOW, copyEn);
    expect(m.band).toEqual({ line1: "this link has expired", line2: null, expired: true });
    expect(m.primary).toEqual({ label: copyEn.ENTER_LOBBY, action: "enterLobby" });
    expect(m.secondary).toBeNull();
    expect(m.consequence).toBeNull();
  });
});
