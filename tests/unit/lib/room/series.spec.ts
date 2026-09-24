import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { seriesLine, seriesViewOf } from "@/lib/room/series";

const A = "a";
const B = "b";

describe("seriesViewOf (spec 071 FR-018)", () => {
  it("numbers this match in its chain and counts the finished ones before it", () => {
    const rows = [
      { matchId: "m1", winnerId: A, ordinal: 1 },
      { matchId: "m2", winnerId: null, ordinal: 2 },
      { matchId: "m3", winnerId: null, ordinal: 3 },
    ];
    expect(seriesViewOf(rows, { matchId: "m3", completed: false, winnerId: null }, A)).toEqual({ ordinal: 3, wins: { playerA: 1, playerB: 0 }, draws: 1 });
  });

  it("counts this match too once it is over", () => {
    const rows = [
      { matchId: "m1", winnerId: B, ordinal: 1 },
      { matchId: "m2", winnerId: A, ordinal: 2 },
    ];
    expect(seriesViewOf(rows, { matchId: "m2", completed: true, winnerId: A }, A)).toEqual({ ordinal: 2, wins: { playerA: 1, playerB: 1 }, draws: 0 });
  });

  it("is nothing for a first match", () => {
    expect(seriesViewOf([{ matchId: "m1", winnerId: null, ordinal: 1 }], { matchId: "m1", completed: false, winnerId: null }, A)).toBeNull();
  });
});

describe("seriesLine", () => {
  it("names the leader, or none when level", () => {
    expect(seriesLine({ ordinal: 2, wins: { playerA: 1, playerB: 0 }, draws: 0 }, { playerA: "Birna", playerB: "Kári" }, copyEn)).toBe("match 2 · Birna 1–0");
    expect(seriesLine({ ordinal: 3, wins: { playerA: 1, playerB: 1 }, draws: 0 }, { playerA: "Birna", playerB: "Kári" }, copyEn)).toBe("match 3 · 1–1");
    expect(seriesLine({ ordinal: 2, wins: { playerA: 0, playerB: 1 }, draws: 0 }, { playerA: "Birna", playerB: "Kári" }, copyIs)).toBe("viðureign 2 · Kári 1–0");
  });
});
