import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import * as geometry from "@/lib/room/bandGeometry";
import { bandsFromWords, chevronPath, computeBandRect, ownerSeatOf } from "@/lib/room/bandGeometry";

const A = "a";
const B = "b";

describe("computeBandRect (design system §5.2)", () => {
  it("horizontal ltr: 20% inset across, 5% along, chevron on the left edge", () => {
    const r = computeBandRect([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }], "ltr");
    expect(r).toEqual({ x: 10.5, y: 22, w: 29, h: 6, chevronEdge: "left", axis: "horizontal" });
  });
  it("rtl keeps the same rect with the chevron on the right edge", () => {
    const r = computeBandRect([{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }], "rtl");
    expect(r).toMatchObject({ x: 10.5, w: 29, chevronEdge: "right" });
  });
  it("vertical ttb/btt swap the insets and put the chevron on top/bottom", () => {
    const down = computeBandRect([{ x: 5, y: 0 }, { x: 5, y: 1 }], "ttb");
    expect(down).toEqual({ x: 52, y: 0.5, w: 6, h: 19, chevronEdge: "top", axis: "vertical" });
    expect(computeBandRect([{ x: 5, y: 1 }, { x: 5, y: 0 }], "btt").chevronEdge).toBe("bottom");
  });
  it("chevron path opens from the reading-start edge with a 0.9-unit arm", () => {
    const r = computeBandRect([{ x: 0, y: 0 }, { x: 1, y: 0 }], "ltr");
    expect(chevronPath(r)).toBe("M 0.5 2 L 1.4 5 L 0.5 8");
  });
});

describe("bandsFromWords", () => {
  const frozen = { "1,2": { owner: "player_a" as const }, "2,2": { owner: "player_a" as const }, "3,2": { owner: "player_a" as const }, "3,5": { owner: "player_b" as const } };
  const words = [
    { roundNumber: 1, playerId: A, word: "þar", totalPoints: 15, coordinates: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }], direction: "ltr" as const },
    { roundNumber: 2, playerId: B, word: "orð", totalPoints: 13, coordinates: [{ x: 3, y: 6 }, { x: 3, y: 5 }, { x: 3, y: 4 }] },
  ];
  /** Every letter frozen by the player who scored it (A → player_a, B → player_b). */
  const allFrozen = (list: { playerId: string; coordinates: { x: number; y: number }[] }[]) =>
    Object.fromEntries(list.flatMap((w) => w.coordinates.map((c) => [`${c.x},${c.y}`, { owner: w.playerId === A ? ("player_a" as const) : ("player_b" as const) }])));
  /** A field on which every record spells its word at its cells (spec 049: a band must spell before it draws). */
  const spelled = (list: { word: string; coordinates: { x: number; y: number }[] }[]) => {
    const board = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "."));
    for (const w of list) [...w.word].forEach((letter, i) => (board[w.coordinates[i].y][w.coordinates[i].x] = letter.toLocaleUpperCase("is")));
    return board;
  };
  const board = spelled(words);

  let warn: MockInstance;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("one band per record, viewer-relative seat, direction from the record or the tiles", () => {
    const bands = bandsFromWords({ words, board, frozenTiles: allFrozen(words), viewerSlot: "player_b", playerAId: A });
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ seat: "opp", direction: "ltr", round: 1, strength: "settled" });
    expect(bands[0].cells).toHaveLength(3);
    expect(bands[1]).toMatchObject({ seat: "you", direction: "btt" });
    expect(bands[1].cells).toHaveLength(3);
    expect(warn).not.toHaveBeenCalled();
  });

  // Spec 047 FR-001 (review S4): a settled word is drawn only over letters that
  // are still frozen. A partial freeze used to clip the band to one cell, which
  // painted a chevron with no band under it.
  it("a settled word with an unfrozen letter is skipped with one development warning", () => {
    const bands = bandsFromWords({ words, board, frozenTiles: frozen, viewerSlot: "player_b", playerAId: A });
    expect(bands.map((b) => b.word)).toEqual(["þar"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/R2 orð: 2 letter\(s\) not frozen/);
  });

  it("a settled word none of whose letters froze is skipped", () => {
    const bands = bandsFromWords({ words: [words[0]], board, frozenTiles: {}, viewerSlot: "player_a", playerAId: A });
    expect(bands).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("the live round keeps its full run before its freezes land; duplicate ids collapse", () => {
    const bands = bandsFromWords({ words: [words[1], words[1]], board, frozenTiles: {}, viewerSlot: "player_a", playerAId: A, liveRound: 2 });
    expect(bands).toHaveLength(1);
    expect(bands[0].cells).toHaveLength(3);
    expect(bands[0].strength).toBe("live");
    expect(warn).not.toHaveBeenCalled();
  });

  it("the most recently scored round is drawn from its coordinates, settled, until its freezes land", () => {
    const bands = bandsFromWords({ words: [words[1]], board, frozenTiles: {}, viewerSlot: "player_a", playerAId: A, trustRound: 2 });
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ strength: "settled", round: 2 });
    expect(bands[0].cells).toHaveLength(3);
    expect(warn).not.toHaveBeenCalled();
  });

  it("never returns a band with fewer than two cells", () => {
    const one = { roundNumber: 2, playerId: B, word: "o", totalPoints: 1, coordinates: [{ x: 3, y: 5 }], direction: "ltr" as const };
    expect(bandsFromWords({ words: [one], board, frozenTiles: frozen, viewerSlot: "player_a", playerAId: A, liveRound: 2 })).toEqual([]);
    expect(bandsFromWords({ words: [one], board, frozenTiles: frozen, viewerSlot: "player_a", playerAId: A })).toEqual([]);
  });

  // Spec 049 (contracts/integrity-check.md, client mirror): on 2026-09-20 the
  // served board was round 1's under ten rounds of records, and settled bands
  // were drawn over ÞKHL, GÁAAT and DUT. A settled band must spell its word.
  it("a settled record whose cells are all frozen but whose letters do not spell the word draws no band", () => {
    const wrong = spelled([{ word: "þkh", coordinates: words[0].coordinates }, words[1]]);
    const bands = bandsFromWords({ words, board: wrong, frozenTiles: allFrozen(words), viewerSlot: "player_b", playerAId: A });
    expect(bands.map((b) => b.word)).toEqual(["orð"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/R1 þar: board spells ÞKH/);
  });

  it("a settled record with the wrong number of tiles draws no band", () => {
    const short = { ...words[0], coordinates: words[0].coordinates.slice(0, 2) };
    const bands = bandsFromWords({ words: [short], board, frozenTiles: allFrozen(words), viewerSlot: "player_a", playerAId: A });
    expect(bands).toEqual([]);
  });

  it("the live and the most recently scored rounds are still drawn from their coordinates", () => {
    const wrong = spelled([{ word: "þkh", coordinates: words[0].coordinates }]);
    const live = bandsFromWords({ words: [words[0]], board: wrong, frozenTiles: {}, viewerSlot: "player_a", playerAId: A, liveRound: 1 });
    const trusted = bandsFromWords({ words: [words[0]], board: wrong, frozenTiles: {}, viewerSlot: "player_a", playerAId: A, trustRound: 1 });
    expect(live).toHaveLength(1);
    expect(trusted).toHaveLength(1);
  });

  // Spec 049 US2 (contracts/ownership-rendering.md): a band covers the letters
  // its word froze first; a crossing keeps the earlier owner; the chevron sits
  // at the whole word's reading start.
  describe("one owner, one colour", () => {
    const abc = { roundNumber: 1, playerId: A, word: "abc", totalPoints: 1, coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] };
    const bxy = { roundNumber: 2, playerId: B, word: "bxy", totalPoints: 1, coordinates: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }] };
    const crossing = [abc, bxy];
    const owners = {
      "0,0": { owner: "player_a" as const }, "1,0": { owner: "player_a" as const }, "2,0": { owner: "player_a" as const },
      "1,1": { owner: "player_b" as const }, "1,2": { owner: "player_b" as const },
    };

    it("ownerSeatOf resolves a frozen cell's owner through the viewer's seat", () => {
      expect(ownerSeatOf(owners, { x: 0, y: 0 }, "player_a")).toBe("you");
      expect(ownerSeatOf(owners, { x: 1, y: 1 }, "player_a")).toBe("opp");
      expect(ownerSeatOf(owners, { x: 1, y: 1 }, "player_b")).toBe("you");
      expect(ownerSeatOf(owners, { x: 9, y: 9 }, "player_a")).toBeNull();
    });

    it("a word that froze all its letters covers all of them", () => {
      const [band] = bandsFromWords({ words: [abc], board: spelled(crossing), frozenTiles: owners, viewerSlot: "player_a", playerAId: A });
      expect(band.cells).toEqual(abc.coordinates);
      expect(band.wordCells).toEqual(abc.coordinates);
    });

    it("a word crossing a letter the other seat froze earlier covers all but that letter, and keeps the whole word", () => {
      const bands = bandsFromWords({ words: crossing, board: spelled(crossing), frozenTiles: owners, viewerSlot: "player_a", playerAId: A });
      const later = bands.find((b) => b.word === "bxy")!;
      expect(later.cells).toEqual([{ x: 1, y: 1 }, { x: 1, y: 2 }]);
      expect(later.wordCells).toEqual(bxy.coordinates);
      expect(later.seat).toBe("opp");
    });

    it("a one-letter extension of the other seat's run keeps its one cell; the chevron comes from the whole word", () => {
      const gata = { roundNumber: 1, playerId: B, word: "gáta", totalPoints: 1, coordinates: [{ x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }] };
      const gatan = { roundNumber: 2, playerId: A, word: "gátan", totalPoints: 1, coordinates: [...gata.coordinates, { x: 4, y: 3 }] };
      const frozen = {
        ...Object.fromEntries(gata.coordinates.map((c) => [`${c.x},${c.y}`, { owner: "player_b" as const }])),
        "4,3": { owner: "player_a" as const },
      };
      const bands = bandsFromWords({ words: [gata, gatan], board: spelled([gatan]), frozenTiles: frozen, viewerSlot: "player_a", playerAId: A });
      const extension = bands.find((b) => b.word === "gátan")!;
      expect(extension.cells).toEqual([{ x: 4, y: 3 }]);
      expect(extension.wordCells).toHaveLength(5);
      expect(computeBandRect(extension.wordCells, extension.direction).x).toBe(0.5);
    });

    it("a word re-crossing its owner's earlier word keeps every cell", () => {
      const own = { ...bxy, playerId: A };
      const allA = Object.fromEntries(Object.keys(owners).map((k) => [k, { owner: "player_a" as const }]));
      const bands = bandsFromWords({ words: [abc, own], board: spelled([abc, own]), frozenTiles: allA, viewerSlot: "player_a", playerAId: A });
      expect(bands.find((b) => b.word === "bxy")!.cells).toEqual(own.coordinates);
    });

    it("a word none of whose letters it owns draws no band; live rounds keep their whole run before their freezes land", () => {
      const allB = Object.fromEntries(Object.keys(owners).map((k) => [k, { owner: "player_b" as const }]));
      expect(bandsFromWords({ words: [abc], board: spelled(crossing), frozenTiles: allB, viewerSlot: "player_a", playerAId: A })).toEqual([]);
      const [live] = bandsFromWords({ words: [abc], board: spelled(crossing), frozenTiles: {}, viewerSlot: "player_a", playerAId: A, liveRound: 1 });
      expect(live.cells).toEqual(abc.coordinates);
    });

    it("sharedCells and seatOfCell are gone: a letter's colour comes from its frozen owner alone", () => {
      expect("sharedCells" in geometry).toBe(false);
      expect("seatOfCell" in geometry).toBe(false);
    });
  });
});
