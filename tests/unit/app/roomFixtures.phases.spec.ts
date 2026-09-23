import { describe, expect, it } from "vitest";

import { isRoomPhase, ROOM_PHASES } from "@/app/[locale]/dev/room/fixtures";

/** Spec 048 contracts/fixture-phases.md, spec 050: one phase per slip and per beat. */
describe("fixture phases (spec 048, spec 050)", () => {
  it.each(["landing-slip", "returning-slip", "resign", "end-early", "over-slip", "scored", "scoring", "opp-reveal", "rejected", "done-waiting", "time-up", "rules", "last-seconds"])("lists %s", (phase) => {
    expect(ROOM_PHASES).toContain(phase);
    expect(isRoomPhase(phase)).toBe(true);
  });

  it("no longer lists a letters-first landing", () => {
    expect(ROOM_PHASES).not.toContain("landing");
    expect(isRoomPhase("landing")).toBe(false);
  });
});
