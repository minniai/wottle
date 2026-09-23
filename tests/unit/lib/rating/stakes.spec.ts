import { describe, expect, it } from "vitest";

import { stakesFor } from "@/lib/rating/stakes";
import { DEFAULT_RATING_RECORD, type RatingRecord } from "@/lib/rating/playerRatings";

const rec = (eloRating: number, gamesPlayed = 0): RatingRecord => ({ ...DEFAULT_RATING_RECORD, eloRating, gamesPlayed });

/** Spec 069 FR-008: the table's stakes are the change the same rule would write. */
describe("stakesFor", () => {
  it("gives +16 / 0 / −16 between equal new players (K 32)", () => {
    expect(stakesFor(rec(1200), rec(1200))).toEqual({ win: 16, draw: 0, loss: -16 });
  });

  it("gives the stronger player less to win and more to lose", () => {
    expect(stakesFor(rec(1204), rec(1187))).toEqual({ win: 15, draw: -1, loss: -17 });
    expect(stakesFor(rec(1187), rec(1204))).toEqual({ win: 17, draw: 1, loss: -15 });
  });

  it("halves after 20 games (K 16)", () => {
    expect(stakesFor(rec(1200, 20), rec(1200))).toEqual({ win: 8, draw: 0, loss: -8 });
  });

  it("never takes a rating below the floor", () => {
    expect(stakesFor(rec(110), rec(110)).loss).toBe(-10);
  });
});
