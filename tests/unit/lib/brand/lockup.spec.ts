import { describe, expect, it } from "vitest";

import { cellMark, lockup, strip } from "@/lib/brand/lockup";

/** Spec 070 FR-005, game flow §6: the marks are the game's own cells. */
describe("lockup (§6)", () => {
  it("Orðusta: 7×6, ORÐUSTA across row 3 in your colour, WOTTLE down column 6 in theirs, crossing at T", () => {
    const l = lockup("is", 72);
    expect(l).toMatchObject({ cols: 7, rows: 6, width: 504, height: 432 });
    const across = l.cells.filter((c) => c.row === 2).sort((a, b) => a.col - b.col);
    expect(across.map((c) => c.letter).join("")).toBe("ORÐUSTA");
    expect(across.every((c) => c.seat === "you")).toBe(true);
    expect(across.map((c) => c.value)).toEqual([5, 1, 2, 2, 1, 2, 1]);
    const down = l.cells.filter((c) => c.col === 5).sort((a, b) => a.row - b.row);
    expect(down.map((c) => c.letter).join("")).toBe("WOTTLE");
    const crossing = down[2];
    expect(crossing).toMatchObject({ letter: "T", seat: "you", value: 2 });
    expect(down.filter((c) => c.row !== 2).map((c) => [c.seat, c.value])).toEqual([["opp", 4], ["opp", 1], ["opp", 1], ["opp", 1], ["opp", 1]]);
    expect(l.cells).toHaveLength(12);
  });

  it("Wottle: 6×7, WOTTLE across, ORÐUSTA down from the shared O, its letters keeping Icelandic values", () => {
    const l = lockup("en", 64);
    expect(l).toMatchObject({ cols: 6, rows: 7, width: 384, height: 448 });
    const across = l.cells.filter((c) => c.row === 0).sort((a, b) => a.col - b.col);
    expect(across.map((c) => c.letter).join("")).toBe("WOTTLE");
    expect(across.map((c) => c.value)).toEqual([4, 1, 1, 1, 1, 1]);
    const down = l.cells.filter((c) => c.col === 1).sort((a, b) => a.row - b.row);
    expect(down.map((c) => c.letter).join("")).toBe("ORÐUSTA");
    expect(down[0]).toMatchObject({ seat: "you", value: 1 });
    expect(down.slice(1).map((c) => c.value)).toEqual([1, 2, 2, 1, 2, 1]);
    expect(down.slice(1).every((c) => c.seat === "opp")).toBe(true);
  });

  it("draws both bands through the crossing, chevrons where each word begins", () => {
    const l = lockup("is", 72);
    const you = l.bands.find((b) => b.seat === "you")!;
    const opp = l.bands.find((b) => b.seat === "opp")!;
    expect(you.chevronEdge).toBe("left");
    expect(opp.chevronEdge).toBe("top");
    expect(you.x).toBeCloseTo(72 * 0.05);
    expect(you.h).toBeCloseTo(72 * 0.6);
    expect(opp.h).toBeCloseTo(6 * 72 - 2 * 72 * 0.05);
  });

  it("sizes letters at 55% of a cell, shows numerals only from 32px cells, and uses the text tone for small opponent letters", () => {
    expect(lockup("is", 72).letterPx).toBeCloseTo(39.6);
    expect(lockup("is", 72).numeralPx).toBeCloseTo(12.96);
    expect(lockup("is", 51).showNumerals).toBe(true);
    expect(lockup("is", 24).showNumerals).toBe(false);
    expect(lockup("is", 24).numeralPx).toBe(9);
    expect(lockup("is", 30).oppTone).toBe("opp-text");
    expect(lockup("is", 51).oppTone).toBe("opp");
  });
});

describe("strip (§6 companion)", () => {
  it("is the locale's name as one word of ink letters, numerals only from 32px cells", () => {
    const s = strip("is", 22);
    expect(s.letters.map((c) => c.letter).join("")).toBe("ORÐUSTA");
    expect(s).toMatchObject({ width: 176, height: 22, showNumerals: false });
    expect(strip("en", 40)).toMatchObject({ width: 280, showNumerals: true });
    expect(strip("en", 40).letters.map((c) => c.value)).toEqual([4, 1, 1, 1, 1, 1]);
  });

  it("seats the chevron in a cell of its own before the word, centred like a letter", () => {
    const s = strip("is", 100);
    expect(s.letters.map((c) => c.col)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.band).toMatchObject({ x: 105, y: 20, w: 690, h: 60 });
    // Cap height tall (34% of a cell), 16% deep, centred on the lead cell.
    expect(s.chevron).toBe("M42 33 L58 50 L42 67");
    expect(strip("is", 22).chevron).toBe("M9.2 7.3 L12.8 11 L9.2 14.7");
  });
});

describe("cell mark (§6 favicon)", () => {
  it("is Ð on / and W on /en in your colour; a call turns the letter theirs", () => {
    expect(cellMark("is", "none")).toMatchObject({ letter: "Ð", tone: "you", value: 2 });
    expect(cellMark("en", "none")).toMatchObject({ letter: "W", tone: "you", value: 4 });
    expect(cellMark("is", "call").tone).toBe("opp");
  });
});

describe("chevronPath", () => {
  it("opens on the band's reading-start edge, 9% of a cell deep", async () => {
    const { chevronPath } = await import("@/lib/brand/lockup");
    const l = lockup("is", 51);
    const you = l.bands.find((b) => b.seat === "you")!;
    expect(chevronPath(you, 51)).toBe("M4.6 113.2 L9.1 127.5 L4.6 141.8");
  });
});
