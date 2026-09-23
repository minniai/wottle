import { describe, expect, it } from "vitest";

import { computeFieldSize, computeScoreboardField } from "@/components/room/hooks/useFieldSize";

const DESKTOP = { paddingX: 112, ledgerWidth: 340, gutter: 56 };
const NARROW = { paddingX: 80, ledgerWidth: 260, gutter: 40 };

describe("computeScoreboardField (spec 068: whole cells under a scoreboard)", () => {
  it("is 713px at 1440×900: ten 71px cells inside a 1.5px frame", () => {
    expect(computeScoreboardField(1440, 900, DESKTOP)).toEqual({ cell: 71, field: 713 });
  });

  it("keeps whole cells below the reference: 1280×800", () => {
    const { cell, field } = computeScoreboardField(1280, 800, DESKTOP);
    expect(Number.isInteger(cell)).toBe(true);
    expect(field).toBe(cell * 10 + 3);
    expect(cell).toBe(61);
  });

  it("is bounded by the width left beside the ledger (the 901–1100px overflow)", () => {
    // 1000 − 80 − 260 − 40 = 620 wide, so cells of 61 however tall the window is.
    expect(computeScoreboardField(1000, 900, NARROW)).toEqual({ cell: 61, field: 613 });
  });

  it("caps the cell at 71", () => {
    expect(computeScoreboardField(2560, 1600, DESKTOP).cell).toBe(71);
  });

  it("on a phone is min(358, width − 32) with fractional cells, since the ledger sits below", () => {
    expect(computeScoreboardField(390, 844, { paddingX: 32, phone: true })).toEqual({ cell: 35.8, field: 358 });
    expect(computeScoreboardField(360, 640, { paddingX: 32, phone: true })).toEqual({ cell: 32.8, field: 328 });
    expect(computeScoreboardField(390, 664, { paddingX: 32, phone: true }).field).toBe(358);
  });

  it("is never negative", () => {
    expect(computeScoreboardField(100, 100, DESKTOP)).toEqual({ cell: 0, field: 0 });
    expect(computeScoreboardField(100, 100, { paddingX: 32, phone: true })).toEqual({ cell: 0, field: 0 });
  });
});

describe("computeFieldSize, the bars layout (lobby, queue)", () => {
  it("is bounded by the width beside the ledger on desktop", () => {
    // Height alone would give 708; the column beside a 260px ledger is 620.
    expect(computeFieldSize(1000, 900, NARROW)).toBe(620);
  });

  it("is unchanged where the height binds", () => {
    expect(computeFieldSize(1440, 900, DESKTOP)).toBe(900 - 120 - 24 - 48);
  });
});
