import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { presenceFromRow, presenceLine } from "@/lib/profile/presenceLine";
import { publicPrimary, type PublicPrimaryInput } from "@/lib/profile/publicPrimary";
import type { LobbyRow } from "@/lib/types/standing";

const NOW = Date.parse("2026-09-24T12:00:00Z");

/** Spec 072 T067: the presence word (never a time), and the public profile's one primary. */
describe("presenceLine", () => {
  it.each([
    [{ state: "here" as const, movesPlayed: null }, "here now", "hér núna"],
    [{ state: "in_match" as const, movesPlayed: 6 }, "in a match · 6 of 10", "í viðureign · 6 af 10"],
    [{ state: "away" as const, movesPlayed: null }, "away", "fjarverandi"],
    [{ state: "not_here" as const, movesPlayed: null }, "not here", "ekki hér"],
  ])("reads %o", (presence, en, is) => {
    expect(presenceLine(presence, copyEn, "is")).toBe(en);
    expect(presenceLine(presence, copyIs, "en")).toBe(is);
  });

  it("names the other lobby", () => {
    expect(presenceLine({ state: "other_lobby", movesPlayed: null }, copyEn, "is")).toBe("in the Icelandic lobby");
    expect(presenceLine({ state: "other_lobby", movesPlayed: null }, copyIs, "en")).toBe("í enska lobbíinu");
  });

  it("reads a live lobby row as the same words", () => {
    const row = (state: LobbyRow["state"], movesPlayed: number | null = null): LobbyRow => ({ playerId: "k", displayName: "Kári", handle: "kári", rating: 1265, state, movesPlayed, record: null });
    expect(presenceFromRow(row("searching"))).toEqual({ state: "here", movesPlayed: null });
    expect(presenceFromRow(row("in_match", 6))).toEqual({ state: "in_match", movesPlayed: 6 });
    expect(presenceFromRow(row("away"))).toEqual({ state: "away", movesPlayed: null });
  });
});

describe("publicPrimary", () => {
  const input = (extra: Partial<PublicPrimaryInput> = {}): PublicPrimaryInput => ({
    signedIn: true,
    presence: { state: "here", movesPlayed: null },
    overlay: undefined,
    closed: false,
    viewer: { rating: 1310, gamesPlayed: 22 },
    owner: { rating: 1265 },
    nowMs: NOW,
    copy: copyEn,
    ...extra,
  });

  it("offers challenge ▸ with the viewer's stakes when they are here", () => {
    expect(publicPrimary(input())).toEqual({ kind: "challenge", label: "challenge ▸", stakes: "english words · win +7 · draw −1 · loss −9" });
  });

  it("shows the sent state while the viewer's challenge is out", () => {
    expect(publicPrimary(input({ overlay: { status: "sent · 0:41", action: "none" } }))).toEqual({ kind: "sent", label: "sent · 0:41" });
  });

  it("offers nothing through a pair's cooldown, saying when", () => {
    expect(publicPrimary(input({ overlay: { action: { againUntilMs: NOW + 42_000 } } }))).toEqual({ kind: "closed", reason: "again in 0:42" });
  });

  it.each(["in_match", "away", "other_lobby", "not_here"] as const)("offers nothing when they are %s", (state) => {
    expect(publicPrimary(input({ presence: { state, movesPlayed: 3 } }))).toEqual({ kind: "closed", reason: null });
  });

  it("offers nothing while the viewer's own match runs", () => {
    expect(publicPrimary(input({ closed: true }))).toEqual({ kind: "closed", reason: null });
  });

  it("offers the lobby to a visitor who is not signed in", () => {
    expect(publicPrimary(input({ signedIn: false }))).toEqual({ kind: "enterLobby", label: copyEn.ENTER_LOBBY });
  });
});
