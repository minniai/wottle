import { describe, expect, it } from "vitest";

import { queueView } from "@/lib/room/queueView";

/** Spec 069 T046: what the queue screen says (B7): searching, paused, the 3:00 check, stopped, cooldown. */
const T0 = 1_000_000;
const at = (s: number) => T0 + s * 1000;

describe("queueView", () => {
  it("searches, counting from when the search began", () => {
    expect(queueView({ queuedAtMs: T0, nowMs: at(7), paused: false })).toEqual({ kind: "searching", elapsedMs: 7_000 });
  });

  it("a paused search says so, whatever the time", () => {
    expect(queueView({ queuedAtMs: T0, nowMs: at(200), paused: true })).toEqual({ kind: "paused" });
  });

  it("at 3:00 asks `still searching?` with a 30s drain, then stops", () => {
    expect(queueView({ queuedAtMs: T0, nowMs: at(180), paused: false })).toEqual({ kind: "stillSearching", elapsedMs: 180_000, drain: 1 });
    expect(queueView({ queuedAtMs: T0, nowMs: at(195), paused: false })).toEqual({ kind: "stillSearching", elapsedMs: 195_000, drain: 0.5 });
    expect(queueView({ queuedAtMs: T0, nowMs: at(210), paused: false })).toEqual({ kind: "stopped" });
  });

  it("an answered check starts the next 3:00 from the answer", () => {
    expect(queueView({ queuedAtMs: T0, nowMs: at(250), paused: false, checkAnsweredAtMs: at(190) })).toEqual({ kind: "searching", elapsedMs: 250_000 });
    expect(queueView({ queuedAtMs: T0, nowMs: at(370), paused: false, checkAnsweredAtMs: at(190) }).kind).toBe("stillSearching");
  });

  it("the cooldown comes first", () => {
    expect(queueView({ queuedAtMs: T0, nowMs: at(5), paused: true, cooldownUntilMs: at(65) })).toEqual({ kind: "cooldown", leftMs: 60_000 });
    expect(queueView({ queuedAtMs: T0, nowMs: at(66), paused: false, cooldownUntilMs: at(65) }).kind).toBe("searching");
  });
});
