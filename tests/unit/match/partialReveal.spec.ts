import { describe, expect, it } from "vitest";

import {
  buildPartialRevealKey,
  deriveRevealHighlightsFromPartial,
  isFirstMoverPlayerA,
} from "@/lib/match/partialReveal";
import type { PartialRoundSummary } from "@/lib/types/match";

const PLAYER_A = "33333333-3333-3333-3333-333333333333";
const PLAYER_B = "44444444-4444-4444-4444-444444444444";

function makePartial(
  overrides: Partial<PartialRoundSummary> = {},
): PartialRoundSummary {
  return {
    matchId: "11111111-1111-1111-1111-111111111111",
    roundNumber: 1,
    firstMoverId: PLAYER_A,
    firstSubmissionAt: "2026-06-09T12:00:00.000Z",
    words: [
      {
        playerId: PLAYER_A,
        word: "köttur",
        length: 6,
        lettersPoints: 8,
        bonusPoints: 20,
        totalPoints: 28,
        coordinates: [
          { x: 1, y: 2 },
          { x: 2, y: 2 },
          { x: 3, y: 2 },
          { x: 4, y: 2 },
          { x: 5, y: 2 },
          { x: 6, y: 2 },
        ],
      },
    ],
    delta: { playerA: 28, playerB: 0 },
    frozenTiles: {},
    ...overrides,
  };
}

describe("buildPartialRevealKey (T023 dedupe key)", () => {
  it("produces a stable key combining firstMoverId and firstSubmissionAt", () => {
    const partial = makePartial();
    expect(buildPartialRevealKey(partial)).toBe(
      `${PLAYER_A}-2026-06-09T12:00:00.000Z`,
    );
  });

  it("returns distinct keys when the first mover changes", () => {
    const a = buildPartialRevealKey(makePartial({ firstMoverId: PLAYER_A }));
    const b = buildPartialRevealKey(makePartial({ firstMoverId: PLAYER_B }));
    expect(a).not.toBe(b);
  });

  it("returns distinct keys when the submission timestamp changes", () => {
    const a = buildPartialRevealKey(
      makePartial({ firstSubmissionAt: "2026-06-09T12:00:00.000Z" }),
    );
    const b = buildPartialRevealKey(
      makePartial({ firstSubmissionAt: "2026-06-09T12:00:01.000Z" }),
    );
    expect(a).not.toBe(b);
  });
});

describe("deriveRevealHighlightsFromPartial (T023 projection)", () => {
  it("projects each scored word's coordinates as a separate highlight group", () => {
    const partial = makePartial({
      words: [
        {
          playerId: PLAYER_A,
          word: "ek",
          length: 2,
          lettersPoints: 4,
          bonusPoints: 0,
          totalPoints: 4,
          coordinates: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        },
        {
          playerId: PLAYER_A,
          word: "is",
          length: 2,
          lettersPoints: 3,
          bonusPoints: 0,
          totalPoints: 3,
          coordinates: [
            { x: 2, y: 0 },
            { x: 3, y: 0 },
          ],
        },
      ],
    });

    const highlights = deriveRevealHighlightsFromPartial(partial);
    expect(highlights).toHaveLength(2);
    expect(highlights[0]).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(highlights[1]).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("returns an empty array when the partial summary has zero words (defensive — fast path normally returns 'no-score' instead)", () => {
    expect(deriveRevealHighlightsFromPartial(makePartial({ words: [] }))).toEqual([]);
  });
});

describe("isFirstMoverPlayerA (T023 player attribution)", () => {
  it("returns true when the first mover ID matches player A", () => {
    expect(isFirstMoverPlayerA(makePartial(), PLAYER_A)).toBe(true);
  });

  it("returns false when player B is the first mover", () => {
    const partial = makePartial({ firstMoverId: PLAYER_B });
    expect(isFirstMoverPlayerA(partial, PLAYER_A)).toBe(false);
  });
});
