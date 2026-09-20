import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetWordIntegrityForTests, assertWordsSpellBoard, reportWordIntegrity } from "@/lib/room/wordIntegrity";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";

/**
 * Spec 047 FR-002 (review S5): a band must spell the ledger's word on the board
 * it is drawn over. The review saw NHMÖ under "úðu" and ERG under "urg".
 */
const row = (letters: string) => [...letters];
const BOARD = [
  row("NHMÖABCDEF"),
  row("ÚÐUGHIJKLM"),
  row("AERGXYZÆÖÞ"),
  row("AAAAAAAAAA"),
];

function record(word: string, coordinates: { x: number; y: number }[], roundNumber = 1): AccumulatedWord {
  return { roundNumber, playerId: "p", word, totalPoints: 1, coordinates };
}

describe("assertWordsSpellBoard", () => {
  it("returns no message when every word spells its run, comparing in Icelandic upper case", () => {
    const words = [
      record("úðu", [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
      record("ERG", [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }], 2),
      record("æö", [{ x: 7, y: 2 }, { x: 8, y: 2 }], 3),
    ];
    expect(assertWordsSpellBoard(BOARD, words)).toEqual([]);
  });

  it("reports a coordinate count that does not match the word's length", () => {
    const words = [record("úðu", [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }])];
    expect(assertWordsSpellBoard(BOARD, words)).toEqual(["R1 úðu: expected 3 coordinates, got 4"]);
  });

  it("reports what the board spells when the letters differ", () => {
    const words = [record("urg", [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }])];
    expect(assertWordsSpellBoard(BOARD, words)).toEqual(["R1 urg: board spells ERG at (1,2)…(3,2)"]);
  });

  it("reports each bad word once with its round prefix and keeps good ones silent", () => {
    const words = [
      record("nhm", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 1),
      record("réi", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 1),
      record("eti", [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 }], 2),
    ];
    expect(assertWordsSpellBoard(BOARD, words)).toEqual([
      "R1 réi: board spells NHM at (0,0)…(2,0)",
      "R2 eti: expected 3 coordinates, got 4",
    ]);
  });
});

/**
 * Spec 049 T020: the report is a warn event in every environment, once per
 * match, never thrown. On 2026-09-20 the mismatch was only visible in
 * development, so production drew ÞKHL under "þaks" and nobody was told.
 */
describe("reportWordIntegrity", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    __resetWordIntegrityForTests();
    log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  const bad = [record("urg", [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }])];
  const lines = () => log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("bands.record-mismatch"));

  it("reports the first mismatch as bands.record-mismatch naming the match and the record, in production", () => {
    reportWordIntegrity("m1", BOARD, bad);
    expect(lines()).toHaveLength(1);
    expect(JSON.parse(lines()[0])).toMatchObject({ event: "bands.record-mismatch", matchId: "m1" });
    expect(lines()[0]).toContain("R1 urg: board spells ERG");
  });

  it("reports once per match, then never again for that match; another match reports on its own", () => {
    reportWordIntegrity("m1", BOARD, bad);
    reportWordIntegrity("m1", BOARD, bad);
    reportWordIntegrity("m1", BOARD, [...bad, record("nhm", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 2)]);
    expect(lines()).toHaveLength(1);
    reportWordIntegrity("m2", BOARD, bad);
    expect(lines()).toHaveLength(2);
  });

  it("stays silent when every record spells, and never throws", () => {
    reportWordIntegrity("m1", BOARD, [record("úðu", [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }])]);
    expect(lines()).toHaveLength(0);
    expect(() => reportWordIntegrity("m3", undefined as never, bad)).not.toThrow();
    expect(() => reportWordIntegrity("m4", BOARD, [{ word: "x" } as never])).not.toThrow();
  });
});
