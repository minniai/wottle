import { describe, expect, it } from "vitest";

import { addNotice, expireNotices, noticeText, removeKind } from "@/lib/room/notices";

describe("notices (design system §5.4, §8)", () => {
  it("same-kind notices replace each other", () => {
    let list = addNotice([], { kind: "pickCleared", byName: "Kári" });
    list = addNotice(list, { kind: "pickCleared", byName: "Elín" });
    expect(list.map((n) => n.kind)).toEqual(["pickCleared"]);
    list = addNotice(list, { kind: "rematchRequest", requesterName: "Kári" });
    list = addNotice(list, { kind: "rematchRequest", requesterName: "Elín" });
    expect(list.filter((n) => n.kind === "rematchRequest")).toHaveLength(1);
    expect(removeKind(list, "rematchRequest").map((n) => n.kind)).toEqual(["pickCleared"]);
  });

  it("every fixed string is exclamation-free", () => {
    for (const n of [{ kind: "pickCleared" as const, byName: "K" }, { kind: "rematchRequest" as const, requesterName: "K" }]) {
      expect(noticeText(n)).not.toContain("!");
    }
  });
});
