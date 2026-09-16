import { describe, expect, it, vi } from "vitest";

import { loadMatchWordHistory } from "@/lib/match/wordHistory";

/**
 * Spec 047 FR-003 (review S5): the client seeds its ledger from every completed
 * round's records instead of remembering broadcasts, so a reload or a rematch
 * never shows another board's words.
 */
const MATCH_ID = "match-1";

const ROUNDS = [
  { id: "r1", round_number: 1 },
  { id: "r2", round_number: 2 },
];

const ENTRIES = [
  { round_id: "r2", player_id: "b", word: "gilt", length: 4, letters_points: 7, bonus_points: 10, total_points: 17, tiles: [{ x: 7, y: 5 }, { x: 7, y: 6 }, { x: 7, y: 7 }, { x: 7, y: 8 }], is_duplicate: false },
  { round_id: "r1", player_id: "a", word: "borð", length: 4, letters_points: 9, bonus_points: 10, total_points: 19, tiles: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }], is_duplicate: false },
];

function buildClient(rounds = ROUNDS, entries = ENTRIES) {
  const roundsQuery = { eq: vi.fn().mockReturnThis(), lt: vi.fn().mockResolvedValue({ data: rounds, error: null }) };
  const entriesQuery = { eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: entries, error: null }) };
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => (table === "rounds" ? roundsQuery : entriesQuery)),
  }));
  return { client: { from } as never, roundsQuery, entriesQuery };
}

describe("loadMatchWordHistory", () => {
  it("returns every completed round's words below the current round, in round order", async () => {
    const { client, roundsQuery, entriesQuery } = buildClient();

    const words = await loadMatchWordHistory(client, MATCH_ID, 3);

    expect(roundsQuery.eq).toHaveBeenCalledWith("match_id", MATCH_ID);
    expect(roundsQuery.eq).toHaveBeenCalledWith("state", "completed");
    expect(roundsQuery.lt).toHaveBeenCalledWith("round_number", 3);
    expect(entriesQuery.eq).toHaveBeenCalledWith("match_id", MATCH_ID);
    expect(entriesQuery.in).toHaveBeenCalledWith("round_id", ["r1", "r2"]);
    expect(words.map((w) => [w.roundNumber, w.word])).toEqual([[1, "borð"], [2, "gilt"]]);
  });

  it("maps tiles to coordinates and derives the reading direction", async () => {
    const { client } = buildClient();

    const [borð, gilt] = await loadMatchWordHistory(client, MATCH_ID, 3);

    expect(borð?.coordinates).toEqual([{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }]);
    expect(borð?.direction).toBe("ltr");
    expect(gilt?.direction).toBe("ttb");
    expect(gilt?.playerId).toBe("b");
    expect(gilt?.totalPoints).toBe(17);
    expect(gilt?.isDuplicate).toBe(false);
  });

  it("returns an empty list when no round is completed yet, without querying entries", async () => {
    const { client, entriesQuery } = buildClient([], []);

    const words = await loadMatchWordHistory(client, MATCH_ID, 1);

    expect(words).toEqual([]);
    expect(entriesQuery.in).not.toHaveBeenCalled();
  });
});
