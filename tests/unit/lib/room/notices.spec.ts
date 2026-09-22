import { describe, expect, it } from "vitest";
import { copyEn } from "@/lib/i18n/copy/en";

import { addNotice, challengeOutcome, expireNotices, noticeKey, noticeText, pickClearedNotice, removeKey, syncChallenges } from "@/lib/room/notices";

describe("notices (design system §5.4, §8)", () => {
  // Like the other move notices, `pick cleared · Kári moved that letter` holds two seconds.
  it("a cleared pick is said for two seconds, then leaves", () => {
    const notice = pickClearedNotice("Kári", 10_000);
    expect(noticeText(notice, copyEn)).toContain("Kári");
    expect(expireNotices([notice], 11_999)).toEqual([notice]);
    expect(expireNotices([notice], 12_000)).toEqual([]);
  });

  it("same-kind notices replace each other", () => {
    let list = addNotice([], pickClearedNotice("Kári", 0));
    list = addNotice(list, pickClearedNotice("Elín", 0));
    expect(list.map((n) => n.kind)).toEqual(["pickCleared"]);
    list = addNotice(list, { kind: "rematchRequest", requesterName: "Kári" });
    list = addNotice(list, { kind: "rematchRequest", requesterName: "Elín" });
    expect(list.filter((n) => n.kind === "rematchRequest")).toHaveLength(1);
    expect(removeKey(list, "rematchRequest").map((n) => n.kind)).toEqual(["pickCleared"]);
  });

  it("each challenge is its own line: a second challenger never overwrites the first", () => {
    let list = addNotice([], { kind: "challenge", fromName: "Nari", inviteId: "i1" });
    list = addNotice(list, { kind: "challenge", fromName: "Silú", inviteId: "i2" });
    expect(list.map((n) => noticeText(n, copyEn))).toEqual(["Nari challenges you · accept ▸ · decline", "Silú challenges you · accept ▸ · decline"]);
    // The same invite polled again replaces its own line.
    list = addNotice(list, { kind: "challenge", fromName: "Nari", inviteId: "i1" });
    expect(list).toHaveLength(2);
    expect(removeKey(list, noticeKey({ kind: "challenge", fromName: "Nari", inviteId: "i1" })).map((n) => noticeText(n, copyEn))).toEqual(["Silú challenges you · accept ▸ · decline"]);
  });

  it("the challenger's line: waiting, then what became of it", () => {
    expect(noticeText({ kind: "challengeSent", toName: "Kári", inviteId: "i1" }, copyEn)).toBe("challenge sent · waiting for Kári");
    // One outgoing challenge at a time: a new one replaces the line.
    let list = addNotice([], { kind: "challengeSent", toName: "Kári", inviteId: "i1" });
    list = addNotice(list, { kind: "challengeSent", toName: "Elín", inviteId: "i2" });
    expect(list.map((n) => noticeText(n, copyEn))).toEqual(["challenge sent · waiting for Elín"]);
  });

  it("the challenge lines follow the poll: new ones join, answered or expired ones leave, other lines stay", () => {
    const nari = { kind: "challenge" as const, fromName: "Nari", inviteId: "i1" };
    const silu = { kind: "challenge" as const, fromName: "Silú", inviteId: "i2" };
    const text = { kind: "text" as const, text: "reconnecting" };
    const both = syncChallenges([text, nari], [nari, silu]);
    expect(both).toEqual([text, nari, silu]);
    expect(syncChallenges(both, [nari, silu])).toBe(both);
    expect(syncChallenges(both, [silu])).toEqual([text, silu]);
  });

  it("what became of a sent challenge", () => {
    const out = { id: "i1", recipientName: "Kári", recipientInMatch: false };
    expect(challengeOutcome({ ...out, status: "declined" }, copyEn)).toBe("Kári declined your challenge");
    expect(challengeOutcome({ ...out, status: "declined", recipientInMatch: true }, copyEn)).toBe("Kári took another challenge");
    expect(challengeOutcome({ ...out, status: "expired" }, copyEn)).toBe("Kári did not answer");
    expect(challengeOutcome({ ...out, status: "accepted" }, copyEn)).toBeNull();
  });

  it("every fixed string is exclamation-free", () => {
    for (const n of [pickClearedNotice("K", 0), { kind: "rematchRequest" as const, requesterName: "K" }]) {
      expect(noticeText(n, copyEn)).not.toContain("!");
    }
  });
});
