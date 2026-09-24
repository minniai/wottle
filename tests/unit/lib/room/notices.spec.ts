import { describe, expect, it } from "vitest";
import { copyEn } from "@/lib/i18n/copy/en";

import { addNotice, expireNotices, noticeKey, noticeText, pickClearedNotice, removeKey } from "@/lib/room/notices";

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
    list = addNotice(list, { kind: "rematch", text: "Kári asks for a rematch · 0:24", drain: 0.8 });
    list = addNotice(list, { kind: "rematch", text: "Elín asks for a rematch · 0:23", drain: 0.77 });
    expect(list.filter((n) => n.kind === "rematch")).toHaveLength(1);
    expect(removeKey(list, "rematch").map((n) => n.kind)).toEqual(["pickCleared"]);
  });

  it("every fixed string is exclamation-free", () => {
    for (const n of [pickClearedNotice("K", 0), { kind: "rematch" as const, text: "K asks for a rematch · 0:24", drain: 0.8 }]) {
      expect(noticeText(n, copyEn)).not.toContain("!");
    }
  });
});
