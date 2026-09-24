import { describe, expect, it } from "vitest";

import { bestWordOf } from "@/lib/room/bestWord";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";

const word = (playerId: string, text: string, totalPoints: number, globalSeq = 1): AccumulatedWord =>
  ({ playerId, moveSeq: 1, globalSeq, word: text, totalPoints, coordinates: [] }) as AccumulatedWord;

describe("bestWordOf (spec 071, D1)", () => {
  it("is the viewer's highest-scoring word", () => {
    const words = [word("me", "lek", 12), word("them", "gilt", 40), word("me", "borða", 29), word("me", "tak", 10)];
    expect(bestWordOf(words, "me")).toEqual({ word: "borða", points: 29 });
  });

  it("keeps the earlier of two words with the same score", () => {
    expect(bestWordOf([word("me", "haf", 13, 4), word("me", "sól", 13, 2)], "me")).toEqual({ word: "sól", points: 13 });
  });

  it("is nothing when the viewer scored no word", () => {
    expect(bestWordOf([word("them", "gilt", 40)], "me")).toBeNull();
  });
});
