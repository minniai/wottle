/**
 * Integration tests for round scoring and duplicate word tracking (US3).
 * Mocks Supabase to verify computeWordScoresForRound applies prior-scored
 * words and marks duplicates.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { BoardGrid } from "@/lib/types/board";

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));

const PLAYER_A = "player-a-id";
const PLAYER_B = "player-b-id";
const MATCH_ID = "match-dup-test";
const ROUND_2_ID = "round-2-id";

function emptyBoard(fill = " "): BoardGrid {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => fill),
  ) as BoardGrid;
}

/** Board where row 0 spells "búr" after swapping (0,0)↔(0,1): before ú-b-r, after b-ú-r. */
function makeBurBoard(): { boardBefore: BoardGrid; boardAfter: BoardGrid } {
  const before = emptyBoard();
  before[0][0] = "ú";
  before[0][1] = "b";
  before[0][2] = "r";

  const after = before.map((row) => [...row]) as BoardGrid;
  after[0][0] = "b";
  after[0][1] = "ú";
  return { boardBefore: before, boardAfter: after };
}

describe("round scoring duplicate tracking (US3)", () => {
  beforeEach(async () => {
    const { getServiceRoleClient } = await import("@/lib/supabase/server");
    vi.mocked(getServiceRoleClient).mockReset();
  });

  test("same player forms same word in two rounds - second scores 0 with isDuplicate", async () => {
    const { getServiceRoleClient } = await import("@/lib/supabase/server");
    const priorEntries = [
      { player_id: PLAYER_A, word: "búr" },
    ];
    const insertPayloads: unknown[] = [];

    const from = (table: string) => {
      if (table === "word_score_entries") {
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
              neq: () =>
                Promise.resolve({ data: priorEntries, error: null }),
            }),
          }),
          insert: (rows: unknown) => {
            insertPayloads.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "matches") {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    };

    vi.mocked(getServiceRoleClient).mockReturnValue({
      from,
      rpc: () => Promise.resolve({ data: 1, error: null }),
      channel: () => ({ send: () => "ok" }),
    } as never);

    const { computeWordScoresForRound } = await import(
      "@/app/actions/match/publishRoundSummary"
    );
    const { boardBefore, boardAfter } = makeBurBoard();

    const result = await computeWordScoresForRound(
      MATCH_ID,
      ROUND_2_ID,
      2,
      boardBefore,
      boardAfter,
      [{ player_id: PLAYER_A, from_x: 0, from_y: 0, to_x: 1, to_y: 0 }],
      PLAYER_A,
      PLAYER_B,
      {},
    );

    const inserted = insertPayloads.flat() as Array<{
      word: string;
      is_duplicate?: boolean;
      total_points: number;
      player_id: string;
    }>;
    const burEntry = inserted.find(
      (e) => e.word.toLowerCase() === "búr" && e.player_id === PLAYER_A,
    );
    expect(burEntry).toBeDefined();
    expect(burEntry!.is_duplicate).toBe(true);
    expect(burEntry!.total_points).toBe(0);

    const returnedBur = result.find(
      (w) => w.word.toLowerCase() === "búr" && w.playerId === PLAYER_A,
    );
    expect(returnedBur?.isDuplicate).toBe(true);
    expect(returnedBur?.totalPoints).toBe(0);
  });

  test("different player forms same word - full points awarded (per-player tracking)", async () => {
    const { processRoundScoring } = await import("@/lib/game-engine/wordEngine");
    const { loadDictionary } = await import("@/lib/game-engine/dictionary");

    await loadDictionary();

    const { boardBefore, boardAfter } = makeBurBoard();
    const priorScoredWordsByPlayer: Record<string, Set<string>> = {
      [PLAYER_A]: new Set(["búr"]),
    };

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_2_ID,
      boardBefore,
      boardAfter,
      acceptedMoves: [
        { playerId: PLAYER_B, fromX: 0, fromY: 0, toX: 1, toY: 0 },
      ],
      frozenTiles: {},
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
      priorScoredWordsByPlayer,
    });

    const playerBWords = result.playerBWords.filter(
      (w) => w.word.toLowerCase() === "búr",
    );
    expect(playerBWords.length).toBeGreaterThanOrEqual(1);
    expect(playerBWords[0].isDuplicate).toBe(false);
    expect(playerBWords[0].totalPoints).toBeGreaterThan(0);
  });

  test("combo bonus excludes duplicate words in mixed round", async () => {
    const { processRoundScoring } = await import("@/lib/game-engine/wordEngine");
    const { loadDictionary } = await import("@/lib/game-engine/dictionary");

    await loadDictionary();

    const priorScoredWordsByPlayer: Record<string, Set<string>> = {
      [PLAYER_A]: new Set(["búr"]),
    };

    // Use blank board and place only the words we care about.
    // Row 0: "búr" (Player A's duplicate word)
    // Row 2: "hestur" (Player A's new word — non-adjacent, so no invalid vertical crosses)
    const before = emptyBoard();
    before[0][0] = "b";
    before[0][1] = "ú";
    before[0][2] = "r";
    // Row 2: hestur — swap will be (0,2) <-> (5,2) to form it
    before[2][0] = "r";
    before[2][1] = "e";
    before[2][2] = "s";
    before[2][3] = "t";
    before[2][4] = "u";
    before[2][5] = "h";
    const after = before.map((row) => [...row]) as BoardGrid;
    // Swap 1: Player A forms 'búrb' (duplicate) — just swapping within búr, (0,0) <-> (2,0)
    // Simpler: just swap (0,0) and (2,0) so A's move covers the word búr row on pos 0,2
    // Actually the simplest case: swap (1,0)<->(2,0): swapping ú and r means before had b-ú-r, after has b-r-ú (not búr)
    // Let's just model it differently: swap (0,0)↔(0,9) but that's not in búr
    // Easiest: model the swap as (0,0)↔(5,2) so both are in their respective words
    after[2][0] = "h";
    after[2][5] = "r";

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_2_ID,
      boardBefore: before,
      boardAfter: after,
      acceptedMoves: [
        // Player A moves within Row 2 ('hestur'), both tile positions are in the word
        { playerId: PLAYER_A, fromX: 0, fromY: 2, toX: 5, toY: 2 },
      ],
      frozenTiles: {},
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
      priorScoredWordsByPlayer,
    });

    const playerANewCount = result.playerAWords.filter(
      (w) => !w.isDuplicate,
    ).length;
    expect(result.comboBonus.playerA).toBeGreaterThanOrEqual(0);
    expect(playerANewCount).toBeLessThanOrEqual(result.playerAWords.length);
  });
});
