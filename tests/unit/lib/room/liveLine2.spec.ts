import { describe, expect, it } from "vitest";

import { LINE2_ORDER, selectLine2, type Line2Kind, type Line2Source } from "@/lib/room/liveLine2";

/** Spec 068 FR-031, contracts/live-line2.md: line 2 shows exactly one thing, by precedence. */
const source = (kind: Line2Kind): Line2Source => ({ kind, text: kind });

describe("selectLine2", () => {
  it("orders offline > back > submit error > refused > pick cleared > end-early offer > missed or stakes > instruction", () => {
    expect(LINE2_ORDER).toEqual(["offline", "back", "submitError", "refused", "pickCleared", "endEarlyOffer", "missedOrStakes", "instruction"]);
  });

  it.each(LINE2_ORDER.slice(0, -1).map((higher, i) => [higher, LINE2_ORDER[i + 1]] as const))("%s outranks %s", (higher, lower) => {
    expect(selectLine2({ [lower]: source(lower), [higher]: source(higher) })?.kind).toBe(higher);
  });

  it("a held lower source shows again once the higher one clears", () => {
    const sources: Partial<Record<Line2Kind, Line2Source>> = { pickCleared: source("pickCleared"), instruction: source("instruction") };
    expect(selectLine2({ ...sources, offline: source("offline") })?.kind).toBe("offline");
    expect(selectLine2(sources)?.kind).toBe("pickCleared");
  });

  it("nothing to say is nothing", () => {
    expect(selectLine2({})).toBeNull();
  });
});
