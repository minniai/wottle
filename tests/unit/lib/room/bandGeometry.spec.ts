import { describe, expect, it } from "vitest";

import { bandsFromWords, chevronPath, computeBandRect, sharedCells, seatOfCell } from "@/lib/room/bandGeometry";

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

  it("one band per record, viewer-relative seat, direction from the record or the tiles, clipped to frozen letters", () => {
    const bands = bandsFromWords({ words, frozenTiles: frozen, viewerSlot: "player_b", playerAId: A });
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ seat: "opp", direction: "ltr", round: 1, strength: "settled" });
    expect(bands[0].cells).toHaveLength(3);
    // orð read bottom-to-top; only (3,5) froze → the band clips to it.
    expect(bands[1]).toMatchObject({ seat: "you", direction: "btt" });
    expect(bands[1].cells).toEqual([{ x: 3, y: 5 }]);
  });

  it("a word none of whose letters froze keeps its full run; duplicate ids collapse; live round marked", () => {
    const bands = bandsFromWords({ words: [...words, words[0]], frozenTiles: {}, viewerSlot: "player_a", playerAId: A, liveRound: 2 });
    expect(bands).toHaveLength(2);
    expect(bands[1].cells).toHaveLength(3);
    expect(bands[1].strength).toBe("live");
    expect(bands[0].strength).toBe("settled");
  });

  it("sharedCells finds letters covered by both seats; seatOfCell resolves a letter's seat", () => {
    const bands = bandsFromWords({
      words: [
        { roundNumber: 1, playerId: A, word: "abc", totalPoints: 1, coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
        { roundNumber: 2, playerId: B, word: "bxy", totalPoints: 1, coordinates: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }] },
      ],
      frozenTiles: {},
      viewerSlot: "player_a",
      playerAId: A,
    });
    expect([...sharedCells(bands)]).toEqual(["1,0"]);
    expect(seatOfCell(bands, { x: 0, y: 0 })).toBe("you");
    expect(seatOfCell(bands, { x: 1, y: 2 })).toBe("opp");
    expect(seatOfCell(bands, { x: 9, y: 9 })).toBeNull();
  });
});
