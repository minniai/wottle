import { describe, expect, it } from "vitest";

import * as table from "@/lib/constants/table";

/** Spec 069: the table's timings are owner decisions (§10 Q10); a change is a spec change. */
describe("the table's constants (spec 069)", () => {
  it("pins every timing", () => {
    expect(table).toMatchObject({
      TABLE_SEAT_WINDOW_MS: 20_000,
      TABLE_LEAD_MS: 4_500,
      SLIP_LIFT_BEFORE_GO_MS: 3_300,
      ATTENTION_INPUT_WINDOW_MS: 30_000,
      ATTENTION_FRESH_MS: 10_000,
      QUEUE_FRESH_MS: 10_000,
      QUEUE_CHECK_AT_MS: 180_000,
      QUEUE_CHECK_DRAIN_MS: 30_000,
      TABLE_LEAVE_WINDOW_MS: 600_000,
      TABLE_LEAVE_COOLDOWN_MS: 300_000,
      TABLE_CHECK_POLL_MS: 3_000,
    });
  });
});
