import { describe, expect, test } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { getCopy } from "@/lib/i18n/getCopy";

type Entry = [string, unknown];

/** Sample arguments by parameter name, so every function renders a real line. */
const SAMPLE: Record<string, unknown> = {
  seconds: 12, hereCount: 3, durationMmSs: "4:52", elapsedMmSs: "0:07", remainingMmSs: "1:10",
  before: 1200, after: 1216, delta: 16, wins: true, letter: "Þ", value: 4, total: 24,
  words: ["hestur"], ownerName: "Kári", move: 4, name: "Kári", landed: 42, next: 5,
  opponentName: "Kári", opponentMoves: 8, clockMmSs: "1:12", moves: 8, state: "playing",
  fromName: "Kári", toName: "Kári", winnerName: "Kári", n: 134, a: 134, b: 88, loserName: "Kári",
  reason: "forfeit", margin: 46, wordsA: 12, wordsB: 9, terrA: 30, terrB: 22, count: 3,
  c: { row: 8, column: "F", letter: "T", value: 2, state: "free" }, monthIndex: 8, year: 2026,
  on: true, you: 30, opp: 22, free: 48, label: "klukkan", time: "1:12", left: 4, limit: 10,
  peak: 1216, weekDelta: "+12", month: "september 2026", result: "win", handle: "kari",
  lengthBonus: 5, missPenalty: "−5", min: 1180, max: 1216, wordmark: "orðusta",
};

function argsFor(fn: (...args: unknown[]) => unknown): unknown[] {
  const params = fn.toString().match(/^\(?([^)=]*)\)?\s*=>/)?.[1] ?? "";
  return params
    .split(",")
    .map((p) => p.trim().split(/[\s:=]/)[0])
    .filter(Boolean)
    .map((p) => SAMPLE[p] ?? 3);
}

function render(value: unknown): string {
  const out = typeof value === "function" ? (value as (...a: unknown[]) => unknown)(...argsFor(value as never)) : value;
  return typeof out === "string" ? out : JSON.stringify(out);
}

const ENGLISH_WORDS = /\b(the|your|waiting|points|match over|you win|opponent|rating pending|challenge|sign in)\b/i;

describe("copy parity (spec 060 FR-011)", () => {
  test("Icelandic has every English key, with the same kind of value", () => {
    for (const [key, value] of Object.entries(copyEn) as Entry[]) {
      expect(copyIs, key).toHaveProperty(key);
      expect(typeof (copyIs as Record<string, unknown>)[key], key).toBe(typeof value);
    }
  });

  test("every Icelandic entry renders a non-empty line without holes", () => {
    for (const [key, value] of Object.entries(copyIs) as Entry[]) {
      const line = render(value);
      expect(line.length, key).toBeGreaterThan(0);
      expect(line, key).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test("no Icelandic line is left in English", () => {
    const leftovers = (Object.entries(copyIs) as Entry[])
      .map(([key, value]) => [key, render(value)] as const)
      .filter(([, line]) => ENGLISH_WORDS.test(line));
    expect(leftovers).toEqual([]);
  });

  test("the wordmark follows the locale", () => {
    expect(copyIs.WORDMARK).toBe("Orðusta");
    expect(copyEn.WORDMARK).toBe("Wottle");
  });

  test("getCopy picks by locale", () => {
    expect(getCopy("is")).toBe(copyIs);
    expect(getCopy("en")).toBe(copyEn);
  });
});
