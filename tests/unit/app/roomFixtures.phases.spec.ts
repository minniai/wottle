import { describe, expect, it } from "vitest";

import { isRoomPhase, ROOM_PHASES } from "@/app/dev/room/fixtures";

/** Spec 048 contracts/fixture-phases.md: one phase per slip and per new beat. */
describe("fixture phases (spec 048)", () => {
  it.each(["landing-slip", "resign", "claim-win", "over-slip", "settle"])("lists %s", (phase) => {
    expect(ROOM_PHASES).toContain(phase);
    expect(isRoomPhase(phase)).toBe(true);
  });

  it("no longer lists a letters-first landing", () => {
    expect(ROOM_PHASES).not.toContain("landing");
    expect(isRoomPhase("landing")).toBe(false);
  });
});
