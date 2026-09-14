import { describe, expect, it } from "vitest";

import { addNotice, expireNotices, frozen, noticeText, removeKind, resignConfirm } from "@/lib/room/notices";

describe("notices (design system §5.4, §8)", () => {
  it("frozen notice reads the fixed string and expires after 2 s", () => {
    const n = frozen("Kári", 2, 1_000);
    expect(noticeText(n)).toBe("frozen · Kári R2 · pick another");
    expect(expireNotices([n], 2_999)).toHaveLength(1);
    expect(expireNotices([n], 3_000)).toHaveLength(0);
  });

  it("resign confirmation expires after 5 s", () => {
    const n = resignConfirm(0);
    expect(noticeText(n)).toBe("resign the match? · yes, resign ▸ · no");
    expect(expireNotices([n], 4_999)).toHaveLength(1);
    expect(expireNotices([n], 5_000)).toHaveLength(0);
  });

  it("at most one transient pick notice at a time; same-kind notices replace each other", () => {
    let list = addNotice([], frozen("Kári", 1, 0));
    list = addNotice(list, { kind: "pickCleared", reason: "opponentPinned" });
    expect(list.map((n) => n.kind)).toEqual(["pickCleared"]);
    list = addNotice(list, { kind: "rematchRequest", requesterName: "Kári" });
    list = addNotice(list, { kind: "rematchRequest", requesterName: "Elín" });
    expect(list.filter((n) => n.kind === "rematchRequest")).toHaveLength(1);
    expect(removeKind(list, "rematchRequest").map((n) => n.kind)).toEqual(["pickCleared"]);
  });

  it("every fixed string is exclamation-free", () => {
    for (const n of [frozen("K", 1), { kind: "rematchRequest" as const, requesterName: "K" }, { kind: "firstMatchRules" as const }, { kind: "claimWin" as const, opponentName: "K" }]) {
      expect(noticeText(n)).not.toContain("!");
    }
  });
});
