import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { deriveRematchView } from "@/lib/room/rematchView";
import type { RematchOffer, RematchRequestView } from "@/lib/types/match";

const ME = "me";
const THEM = "them";
const NOW = Date.parse("2026-09-24T12:00:06.000Z");

const OFFER: RematchOffer = {
  offered: true,
  reason: null,
  request: null,
  windowEndsAt: "2026-09-24T12:01:30.000Z",
  cooldownUntil: null,
  opponentOnMatch: true,
  opponentHere: true,
};

function request(over: Partial<RematchRequestView>): RematchRequestView {
  return { id: "r1", requesterId: ME, status: "pending", createdAt: "2026-09-24T12:00:00.000Z", expiresAt: "2026-09-24T12:00:30.000Z", newMatchId: null, ...over };
}

const view = (offer: Partial<RematchOffer>, copy = copyEn, nowMs = NOW) => deriveRematchView({ offer: { ...OFFER, ...offer }, viewerId: ME, opponentName: "Kári", nowMs }, copy);

describe("deriveRematchView (spec 071, contracts/room-derivations.md)", () => {
  it("offers rematch ▸ while nothing has been asked", () => {
    expect(view({})).toEqual({ kind: "offered" });
  });

  it("counts a sent request down with its drain", () => {
    expect(view({ offered: false, request: request({}) })).toEqual({ kind: "sent", line: "rematch sent · 0:24", secondsLeft: 24, drain: 0.8 });
    expect(view({ offered: false, request: request({}) }, copyIs).kind === "sent" && view({ offered: false, request: request({}) }, copyIs)).toMatchObject({ line: "beiðni send · 0:24" });
  });

  it("names the asker of an incoming request", () => {
    const incoming = view({ offered: false, request: request({ requesterId: THEM }) });
    expect(incoming).toEqual({ kind: "incoming", line: "Kári asks for a rematch · 0:24", secondsLeft: 24, drain: 0.8 });
    expect(view({ offered: false, request: request({ requesterId: THEM }) }, copyIs)).toMatchObject({ line: "Kári vill aðra viðureign · 0:24" });
  });

  it("holds at 0:00 until the server says the request ran out", () => {
    expect(view({ offered: false, request: request({}) }, copyEn, Date.parse("2026-09-24T12:00:31.000Z"))).toMatchObject({ kind: "sent", secondsLeft: 0, drain: 0, line: "rematch sent · 0:00" });
  });

  it.each([
    ["declined, to the sender", { status: "declined" as const }, "Kári declined"],
    ["declined, to the decliner", { status: "declined" as const, requesterId: THEM }, null],
    ["unanswered", { status: "expired" as const }, "no answer"],
    ["withdrawn, to the recipient", { status: "withdrawn" as const, requesterId: THEM }, "Kári withdrew"],
    ["withdrawn, to the sender", { status: "withdrawn" as const }, null],
    ["superseded, to the sender", { status: "superseded" as const }, "Kári started another match"],
  ])("closes the rematch once %s", (_name, over, line) => {
    const closed = view({ offered: false, request: request(over), reason: over.status });
    expect(closed).toMatchObject({ kind: "closed", line });
  });

  it("says the opponent has left, and nothing when the window closed", () => {
    expect(view({ offered: false, reason: "opponent_left", opponentOnMatch: false, opponentHere: false })).toEqual({ kind: "closed", line: "Kári has left", challengeAgain: null });
    expect(view({ offered: false, reason: "opponent_left", opponentOnMatch: false }, copyIs)).toMatchObject({ line: "Kári fór" });
    expect(view({ offered: false, reason: "window_closed" })).toMatchObject({ kind: "closed", line: null });
  });

  it("offers challenge again ▸ when the opponent is here, waiting out the cooldown", () => {
    expect(view({ offered: false, reason: "window_closed" })).toMatchObject({ challengeAgain: { enabled: true, label: "challenge again ▸" } });
    const cooling = view({ offered: false, request: request({ status: "declined" }), reason: "declined", cooldownUntil: "2026-09-24T12:00:58.000Z" });
    expect(cooling).toMatchObject({ challengeAgain: { enabled: false, label: "again in 0:52" } });
    expect(view({ offered: false, reason: "declined", cooldownUntil: "2026-09-24T12:00:58.000Z" }, copyIs)).toMatchObject({ challengeAgain: { label: "aftur eftir 0:52" } });
    expect(view({ offered: false, reason: "window_closed", opponentHere: false })).toMatchObject({ challengeAgain: null });
  });

  it("says an accepted request was accepted, with the new match", () => {
    expect(view({ offered: false, request: request({ status: "accepted", newMatchId: "m2" }) })).toEqual({ kind: "accepted", line: "Kári accepted", newMatchId: "m2" });
  });
});
