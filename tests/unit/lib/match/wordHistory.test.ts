import { describe, expect, it, vi } from "vitest";

import { loadMatchWordHistory } from "@/lib/match/wordHistory";

/**
 * Spec 047 FR-003 (review S5), spec 050: the client seeds its ledger from every
 * resolved move's records instead of remembering broadcasts, so a reload or a
 * rematch never shows another board's words.
 */
const MATCH_ID = "match-1";

const MOVES = [
  { id: "mv-2", seq: 1, global_seq: 2 },
  { id: "mv-1", seq: 1, global_seq: 1 },
];

const ENTRIES = [
  { move_id: "mv-2", player_id: "b", word: "gilt", length: 4, letters_points: 7, bonus_points: 10, total_points: 17, tiles: [{ x: 7, y: 5 }, { x: 7, y: 6 }, { x: 7, y: 7 }, { x: 7, y: 8 }] },
  { move_id: "mv-1", player_id: "a", word: "borð", length: 4, letters_points: 9, bonus_points: 10, total_points: 19, tiles: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }] },
];

function buildClient(moves = MOVES, entries = ENTRIES) {
  const movesQuery = { eq: vi.fn() };
  movesQuery.eq.mockReturnValueOnce(movesQuery).mockResolvedValue({ data: moves, error: null });
  const entriesQuery = { eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: entries, error: null }) };
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => (table === "match_moves" ? movesQuery : entriesQuery)),
  }));
  return { client: { from } as never, movesQuery, entriesQuery };
}

describe("loadMatchWordHistory", () => {
  it("returns every resolved move's words in receipt order, each with the mover's move number", async () => {
    const { client, movesQuery, entriesQuery } = buildClient();

    const words = await loadMatchWordHistory(client, MATCH_ID);

    expect(movesQuery.eq).toHaveBeenCalledWith("match_id", MATCH_ID);
    expect(movesQuery.eq).toHaveBeenCalledWith("status", "resolved");
    expect(entriesQuery.eq).toHaveBeenCalledWith("match_id", MATCH_ID);
    expect(entriesQuery.in).toHaveBeenCalledWith("move_id", ["mv-2", "mv-1"]);
    expect(words.map((w) => [w.globalSeq, w.moveSeq, w.playerId, w.word])).toEqual([[1, 1, "a", "borð"], [2, 1, "b", "gilt"]]);
  });

  it("maps tiles to coordinates and derives the reading direction", async () => {
    const { client } = buildClient();

    const [borð, gilt] = await loadMatchWordHistory(client, MATCH_ID);

    expect(borð?.coordinates).toEqual([{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }]);
    expect(borð?.direction).toBe("ltr");
    expect(gilt?.direction).toBe("ttb");
    expect(gilt?.totalPoints).toBe(17);
  });

  it("returns an empty list when no move has resolved yet, without querying entries", async () => {
    const { client, entriesQuery } = buildClient([], []);

    const words = await loadMatchWordHistory(client, MATCH_ID);

    expect(words).toEqual([]);
    expect(entriesQuery.in).not.toHaveBeenCalled();
  });
});
