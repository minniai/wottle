import { describe, expect, it } from "vitest";

import {
  buildCurrentRoundScoredFromPartial,
  buildCurrentRoundScoredFromSummary,
} from "@/lib/match/currentRoundScored";
import {
  PLAYER_A_HIGHLIGHT,
  PLAYER_B_HIGHLIGHT,
} from "@/lib/constants/playerColors";
import type {
  PartialRoundSummary,
  RoundSummary,
  WordScore,
} from "@/lib/types/match";

const PLAYER_A = "33333333-3333-3333-3333-333333333333";
const PLAYER_B = "44444444-4444-4444-4444-444444444444";

function word(overrides: Partial<WordScore> = {}): WordScore {
  return {
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
    ...overrides,
  };
}

function makeSummary(overrides: Partial<RoundSummary> = {}): RoundSummary {
  return {
    matchId: "11111111-1111-1111-1111-111111111111",
    roundNumber: 1,
    words: [word()],
    highlights: [],
    deltas: { playerA: 4, playerB: 0 },
    totals: { playerA: 4, playerB: 0 },
    resolvedAt: "2026-06-09T12:00:00.000Z",
    ...overrides,
  } as RoundSummary;
}

function makePartial(
  overrides: Partial<PartialRoundSummary> = {},
): PartialRoundSummary {
  return {
    matchId: "11111111-1111-1111-1111-111111111111",
    roundNumber: 1,
    firstMoverId: PLAYER_A,
    firstSubmissionAt: "2026-06-09T12:00:00.000Z",
    words: [word()],
    delta: { playerA: 4, playerB: 0 },
    frozenTiles: {},
    ...overrides,
  };
}

describe("buildCurrentRoundScoredFromSummary", () => {
  it("maps each scored tile to a canonical 'x,y' key with the scoring player's color", () => {
    const map = buildCurrentRoundScoredFromSummary(makeSummary(), PLAYER_A);
    expect(map).toEqual({
      "0,0": PLAYER_A_HIGHLIGHT,
      "1,0": PLAYER_A_HIGHLIGHT,
    });
  });

  it("attributes player B words to the player B color", () => {
    const summary = makeSummary({
      words: [
        word({
          playerId: PLAYER_B,
          coordinates: [
            { x: 5, y: 5 },
            { x: 6, y: 5 },
          ],
        }),
      ],
    });
    const map = buildCurrentRoundScoredFromSummary(summary, PLAYER_A);
    expect(map).toEqual({
      "5,5": PLAYER_B_HIGHLIGHT,
      "6,5": PLAYER_B_HIGHLIGHT,
    });
  });

  it("merges coordinates across multiple words", () => {
    const summary = makeSummary({
      words: [
        word({ coordinates: [{ x: 0, y: 0 }] }),
        word({ coordinates: [{ x: 9, y: 9 }] }),
      ],
    });
    const map = buildCurrentRoundScoredFromSummary(summary, PLAYER_A);
    expect(Object.keys(map).sort()).toEqual(["0,0", "9,9"]);
  });

  it("returns an empty map for a zero-word (pass / no-score) round", () => {
    expect(buildCurrentRoundScoredFromSummary(makeSummary({ words: [] }), PLAYER_A)).toEqual(
      {},
    );
  });
});

describe("buildCurrentRoundScoredFromPartial", () => {
  it("maps the first mover's scored tiles to their player color", () => {
    const map = buildCurrentRoundScoredFromPartial(makePartial(), PLAYER_A);
    expect(map).toEqual({
      "0,0": PLAYER_A_HIGHLIGHT,
      "1,0": PLAYER_A_HIGHLIGHT,
    });
  });

  it("returns an empty map when the partial summary has no words", () => {
    expect(buildCurrentRoundScoredFromPartial(makePartial({ words: [] }), PLAYER_A)).toEqual(
      {},
    );
  });

  it("produces the same keys/colors as the full summary for the same first-mover words (no re-attribution on FR-011 merge)", () => {
    const fromPartial = buildCurrentRoundScoredFromPartial(makePartial(), PLAYER_A);
    const fromSummary = buildCurrentRoundScoredFromSummary(makeSummary(), PLAYER_A);
    expect(fromPartial).toEqual(fromSummary);
  });
});
