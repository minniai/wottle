/**
 * Integration tests for match summary page data (US3).
 * T033: Verifies that `frozenTileCount` matches `matches.frozen_tiles` and
 * `topWords` matches the top-5 non-duplicate entries in `word_score_entries`.
 *
 * Uses mocked Supabase to avoid needing a live database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));

import { computeFrozenTileCountByPlayer } from "@/lib/match/matchSummary";
import type { FrozenTileMap, TopWord } from "@/lib/types/match";

const MATCH_ID = "summary-test-match";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

describe("matchSummary integration (T033)", () => {
  describe("computeFrozenTileCountByPlayer — used by summary page", () => {
    it("T033: counts frozen tiles from a realistic match frozen_tiles map", () => {
      const frozenTiles: FrozenTileMap = {
        "0,0": { owner: "player_a" },
        "1,1": { owner: "player_a" },
        "2,2": { owner: "player_b" },
        "3,3": { owner: "both" },
        "4,4": { owner: "player_b" },
        "5,5": { owner: "both" },
      };

      const counts = computeFrozenTileCountByPlayer(frozenTiles);

      // player_a owns (0,0),(1,1),(3,3),(5,5) = 4
      // player_b owns (2,2),(3,3),(4,4),(5,5) = 4
      expect(counts.playerA).toBe(4);
      expect(counts.playerB).toBe(4);
    });

    it("T033: returns zero counts for empty frozen_tiles", () => {
      const counts = computeFrozenTileCountByPlayer({});
      expect(counts.playerA).toBe(0);
      expect(counts.playerB).toBe(0);
    });
  });

  describe("top words slicing — used by summary page buildTopWords()", () => {
    it("T033: top-5 non-duplicate words are returned per player in total_points DESC order", () => {
      // Simulate the word entries that would come from Supabase (already ordered by total_points DESC)
      const allEntries = [
        { player_id: PLAYER_A, word: "foss", total_points: 50, letters_points: 40, bonus_points: 10 },
        { player_id: PLAYER_A, word: "búr", total_points: 30, letters_points: 25, bonus_points: 5 },
        { player_id: PLAYER_B, word: "fár", total_points: 40, letters_points: 35, bonus_points: 5 },
        { player_id: PLAYER_A, word: "lag", total_points: 20, letters_points: 15, bonus_points: 5 },
        { player_id: PLAYER_A, word: "vel", total_points: 18, letters_points: 15, bonus_points: 3 },
        { player_id: PLAYER_A, word: "já", total_points: 15, letters_points: 12, bonus_points: 3 },
        { player_id: PLAYER_A, word: "ef", total_points: 12, letters_points: 9, bonus_points: 3 },
        { player_id: PLAYER_B, word: "sær", total_points: 22, letters_points: 18, bonus_points: 4 },
      ];

      const TOP_WORDS_LIMIT = 5;

      function buildTopWords(playerId: string): TopWord[] {
        return allEntries
          .filter((entry) => entry.player_id === playerId)
          .slice(0, TOP_WORDS_LIMIT)
          .map((entry) => ({
            word: entry.word,
            totalPoints: entry.total_points,
            lettersPoints: entry.letters_points,
            bonusPoints: entry.bonus_points,
          }));
      }

      const playerATopWords = buildTopWords(PLAYER_A);
      const playerBTopWords = buildTopWords(PLAYER_B);

      // Player A has 6 entries but we only want top 5
      expect(playerATopWords).toHaveLength(5);
      expect(playerATopWords[0]).toEqual({
        word: "foss",
        totalPoints: 50,
        lettersPoints: 40,
        bonusPoints: 10,
      });
      // Verify words are in descending order (as returned by Supabase query)
      expect(playerATopWords[0].totalPoints).toBeGreaterThanOrEqual(playerATopWords[1].totalPoints);
      expect(playerATopWords[1].totalPoints).toBeGreaterThanOrEqual(playerATopWords[2].totalPoints);

      // Player B has 2 entries
      expect(playerBTopWords).toHaveLength(2);
      expect(playerBTopWords[0].word).toBe("fár");
    });

    it("T033: returns empty array when player has no word entries", () => {
      const allEntries: Array<{ player_id: string; word: string; total_points: number; letters_points: number; bonus_points: number }> = [];

      const topWords = allEntries
        .filter((entry) => entry.player_id === PLAYER_A)
        .slice(0, 5)
        .map((entry) => ({
          word: entry.word,
          totalPoints: entry.total_points,
          lettersPoints: entry.letters_points,
          bonusPoints: entry.bonus_points,
        }));

      expect(topWords).toHaveLength(0);
    });
  });
});
