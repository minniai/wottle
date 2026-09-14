import { describe, expect, it } from "vitest";

import { applyStep, planDuration, planReveal, REVEAL_DONE, REVEAL_START } from "@/lib/room/revealSequence";

describe("planReveal (design system §6, §7; Clarifications Q3)", () => {
  it("three words: bands at 0/520/1040, writes at band end, count-up after the last band, settle +600", () => {
    const steps = planReveal(["a", "b", "c"], { reducedMotion: false, alreadyDrawn: new Set() });
    expect(steps).toEqual([
      { at: 0, kind: "band", wordIndex: 0 },
      { at: 400, kind: "write", wordIndex: 0 },
      { at: 520, kind: "band", wordIndex: 1 },
      { at: 920, kind: "write", wordIndex: 1 },
      { at: 1040, kind: "band", wordIndex: 2 },
      { at: 1440, kind: "write", wordIndex: 2 },
      { at: 1440, kind: "countUp" },
      { at: 2040, kind: "settle" },
    ]);
    expect(planDuration(steps)).toBe(2040);
  });

  it("no words → settle only; reduced motion → settle only", () => {
    expect(planReveal([], { reducedMotion: false, alreadyDrawn: new Set() })).toEqual([{ at: 0, kind: "settle" }]);
    expect(planReveal(["a"], { reducedMotion: true, alreadyDrawn: new Set() })).toEqual([{ at: 0, kind: "settle" }]);
  });

  it("words already drawn by the first-mover reveal get no band or write step (draw once)", () => {
    const steps = planReveal(["a", "b"], { reducedMotion: false, alreadyDrawn: new Set(["a"]) });
    expect(steps.filter((s) => s.kind === "band")).toHaveLength(1);
    expect(steps.filter((s) => s.kind === "write")).toHaveLength(1);
    expect(planDuration(steps)).toBe(1000);
  });

  it("applyStep advances progress monotonically and settle completes everything", () => {
    let p = REVEAL_START;
    p = applyStep(p, { at: 0, kind: "band", wordIndex: 0 });
    expect(p.bandsDrawn).toBe(1);
    p = applyStep(p, { at: 400, kind: "write", wordIndex: 0 });
    expect(p.wordsWritten).toBe(1);
    p = applyStep(p, { at: 400, kind: "countUp" });
    expect(p.totalsShown).toBe(true);
    expect(applyStep(p, { at: 1000, kind: "settle" })).toEqual(REVEAL_DONE);
  });
});
