import { describe, expect, it } from "vitest";

import { derivePostGameHighlightColors } from "@/components/match/derivePostGameHighlightColors";
import {
  PLAYER_A_HOVER_HIGHLIGHT,
  PLAYER_B_HOVER_HIGHLIGHT,
} from "@/lib/constants/playerColors";
import type { WordHistoryRow } from "@/components/match/FinalSummary";
import type { FrozenTileMap } from "@/lib/types/match";

function makeWord(overrides: Partial<WordHistoryRow> = {}): WordHistoryRow {
  return {
    roundNumber: 1,
    playerId: "player-a",
    word: "búr",
    totalPoints: 20,
    lettersPoints: 15,
    bonusPoints: 5,
    coordinates: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    ...overrides,
  };
}

describe("derivePostGameHighlightColors", () => {
  it("colors each tile by its frozen owner, not the word author", () => {
    // Word authored by player A passing through tiles that were last frozen by
    // player B — every coord should glow blue, not orange.
    const words: WordHistoryRow[] = [
      makeWord({
        playerId: "player-a",
        coordinates: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
      }),
    ];
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_b" },
      "1,0": { owner: "player_b" },
      "2,0": { owner: "player_b" },
    };

    const colors = derivePostGameHighlightColors(words, frozenTiles, "player-a");

    expect(colors["0,0"]).toBe(PLAYER_B_HOVER_HIGHLIGHT);
    expect(colors["1,0"]).toBe(PLAYER_B_HOVER_HIGHLIGHT);
    expect(colors["2,0"]).toBe(PLAYER_B_HOVER_HIGHLIGHT);
  });

  it("colors mixed-ownership tiles individually", () => {
    const words: WordHistoryRow[] = [
      makeWord({
        playerId: "player-a",
        coordinates: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
      }),
    ];
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_b" },
      "1,0": { owner: "player_a" },
      "2,0": { owner: "player_a" },
    };

    const colors = derivePostGameHighlightColors(words, frozenTiles, "player-a");

    expect(colors["0,0"]).toBe(PLAYER_B_HOVER_HIGHLIGHT);
    expect(colors["1,0"]).toBe(PLAYER_A_HOVER_HIGHLIGHT);
    expect(colors["2,0"]).toBe(PLAYER_A_HOVER_HIGHLIGHT);
  });

  it("falls back to the word author's color for unfrozen tiles", () => {
    const words: WordHistoryRow[] = [
      makeWord({
        playerId: "player-b",
        coordinates: [{ x: 4, y: 4 }],
      }),
    ];
    const frozenTiles: FrozenTileMap = {};

    const colors = derivePostGameHighlightColors(words, frozenTiles, "player-a");

    expect(colors["4,4"]).toBe(PLAYER_B_HOVER_HIGHLIGHT);
  });

  it("merges multiple words (round-level hover)", () => {
    const words: WordHistoryRow[] = [
      makeWord({
        playerId: "player-a",
        coordinates: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      }),
      makeWord({
        playerId: "player-b",
        coordinates: [
          { x: 5, y: 5 },
          { x: 6, y: 5 },
        ],
      }),
    ];
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,0": { owner: "player_a" },
      "5,5": { owner: "player_b" },
      "6,5": { owner: "player_b" },
    };

    const colors = derivePostGameHighlightColors(words, frozenTiles, "player-a");

    expect(colors["0,0"]).toBe(PLAYER_A_HOVER_HIGHLIGHT);
    expect(colors["1,0"]).toBe(PLAYER_A_HOVER_HIGHLIGHT);
    expect(colors["5,5"]).toBe(PLAYER_B_HOVER_HIGHLIGHT);
    expect(colors["6,5"]).toBe(PLAYER_B_HOVER_HIGHLIGHT);
  });

  it("returns an empty map for an empty word array", () => {
    expect(derivePostGameHighlightColors([], {}, "player-a")).toEqual({});
  });
});

describe("PLAYER_X_HOVER_HIGHLIGHT brightness", () => {
  it("is brighter than the regular tile colors (OKLCH lightness ≥ 0.8)", () => {
    const oklchLightness = (value: string): number | null => {
      const match = value.match(/oklch\(\s*([0-9.]+)/);
      return match ? Number(match[1]) : null;
    };
    expect(oklchLightness(PLAYER_A_HOVER_HIGHLIGHT)!).toBeGreaterThanOrEqual(0.8);
    expect(oklchLightness(PLAYER_B_HOVER_HIGHLIGHT)!).toBeGreaterThanOrEqual(0.8);
  });
});
