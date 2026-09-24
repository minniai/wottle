import { describe, expect, it } from "vitest";

import { composeRematchOffer, type RematchFacts } from "@/lib/match/rematchOffer";

const NOW = Date.parse("2026-09-24T12:01:00.000Z");
const FACTS: RematchFacts = {
  match: { state: "completed", endedReason: "moves_complete", completedAt: "2026-09-24T12:00:00.000Z", playerAId: "me", playerBId: "them" },
  viewerId: "me",
  request: null,
  viewerOnMatch: true,
  opponentOnMatch: true,
  cooldownUntil: null,
  opponentPresence: "present",
};

const offer = (over: Partial<RematchFacts> = {}, nowMs = NOW) => composeRematchOffer({ ...FACTS, ...over }, nowMs);

describe("composeRematchOffer (spec 071 FR-010, R8)", () => {
  it("offers a rematch while nothing is asked, inside 2:00, with both on the match", () => {
    expect(offer()).toEqual({
      offered: true,
      reason: null,
      request: null,
      windowEndsAt: "2026-09-24T12:02:00.000Z",
      cooldownUntil: null,
      opponentOnMatch: true,
      opponentHere: true,
    });
  });

  it.each([
    ["the window has closed", {}, Date.parse("2026-09-24T12:02:01.000Z"), "window_closed"],
    ["the opponent has left", { opponentOnMatch: false }, NOW, "opponent_left"],
    ["the viewer is not on it", { viewerOnMatch: false }, NOW, "self_left"],
  ] as const)("does not offer it when %s", (_name, over, nowMs, reason) => {
    expect(offer(over, nowMs)).toMatchObject({ offered: false, reason });
  });

  it("takes its reason from a request that has ended, and offers nothing once one exists", () => {
    const request = { id: "r1", requesterId: "me", status: "declined" as const, createdAt: "2026-09-24T12:00:10.000Z", expiresAt: "2026-09-24T12:00:40.000Z", newMatchId: null };
    expect(offer({ request })).toMatchObject({ offered: false, reason: "declined", request });
    expect(offer({ request: { ...request, status: "pending" } })).toMatchObject({ offered: false, reason: null });
  });

  it("offers nothing for a void, abandoned or unfinished match", () => {
    expect(offer({ match: { ...FACTS.match, endedReason: "void" } })).toMatchObject({ offered: false, reason: "not_completed" });
    expect(offer({ match: { ...FACTS.match, endedReason: "abandoned" } })).toMatchObject({ offered: false, reason: "not_completed" });
    expect(offer({ match: { ...FACTS.match, state: "in_progress" } })).toMatchObject({ offered: false, reason: "not_completed" });
  });

  it("carries the pair cooldown and whether the opponent is here to be challenged", () => {
    expect(offer({ cooldownUntil: "2026-09-24T12:01:30.000Z" })).toMatchObject({ cooldownUntil: "2026-09-24T12:01:30.000Z" });
    expect(offer({ opponentPresence: "away" })).toMatchObject({ opponentHere: false });
    expect(offer({ opponentPresence: "gone" })).toMatchObject({ opponentHere: false });
  });
});
