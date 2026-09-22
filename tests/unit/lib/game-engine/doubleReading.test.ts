import { beforeAll, describe, expect, test } from "vitest";

import { loadDictionary } from "@/lib/game-engine/dictionary";
import { deriveReadingDirection } from "@/lib/game-engine/readingDirection";
import { scoreMovesInReceiptOrder } from "../../../helpers/scoreMoves";
import type { BoardGrid } from "@/lib/types/board";

function emptyBoard(): BoardGrid {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => " ")) as BoardGrid;
}

const PLAYER_A = "player-a-id";
const PLAYER_B = "player-b-id";

async function scoreRowSwap(board: BoardGrid, fromX: number, toX: number) {
  return scoreMovesInReceiptOrder({
    matchId: "m",
    roundId: "r",
    boardBefore: board,
    acceptedMoves: [
      { playerId: PLAYER_A, fromX, fromY: 0, toX, toY: 0, submittedAt: "2026-01-01T00:00:00Z" },
    ],
    frozenTiles: {},
    playerAId: PLAYER_A,
    playerBId: PLAYER_B,
  });
}

/**
 * Rules §3.1 "Both directions are scored if valid": a run that reads as a word both ways is
 * scored twice, yielding two records.
 */
describe("§3.1 both directions are scored if valid", () => {
  beforeAll(async () => {
    await loadDictionary();
  });

  test("FÁR/RÁF scores twice, yielding two records", async () => {
    const board = emptyBoard();
    board[0][0] = "f";
    board[0][1] = "á";
    board[0][5] = "r";
    const result = await scoreRowSwap(board, 2, 5); // f á _ … r → f á r

    // Now it should return both 'fár' and 'ráf'
    const words = result.playerAWords.map((w) => w.word);
    expect(words).toContain("fár");
    expect(words).toContain("ráf");
    expect(result.playerAWords.length).toBe(2);
    
    // Sort words for assertions
    const sortedWords = [...result.playerAWords].sort((a, b) => a.word.localeCompare(b.word));
    
    expect(sortedWords[0].word).toBe("fár");
    expect(sortedWords[0].tiles).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(deriveReadingDirection(sortedWords[0].tiles)).toBe("ltr");

    expect(sortedWords[1].word).toBe("ráf");
    expect(sortedWords[1].tiles).toEqual([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
    expect(deriveReadingDirection(sortedWords[1].tiles)).toBe("rtl");
  });

  test("a word valid only reversed keeps reversed tile order (rtl)", async () => {
    // Row reads r u t s e _ … h → after swap r u t s e h = "hestur" read right-to-left
    const board = emptyBoard();
    ["r", "u", "t", "s", "e"].forEach((ch, i) => {
      board[0][i] = ch;
    });
    board[0][7] = "h";
    const result = await scoreRowSwap(board, 5, 7);

    expect(result.playerAWords.map((w) => w.word)).toEqual(["hestur"]);
    expect(result.playerAWords[0].tiles[0]).toEqual({ x: 5, y: 0 });
    expect(deriveReadingDirection(result.playerAWords[0].tiles)).toBe("rtl");
  });

  test("a single-direction run produces exactly one record", async () => {
    const board = emptyBoard();
    ["r", "e", "s", "t", "u", "h"].forEach((ch, i) => {
      board[0][i] = ch;
    });
    const result = await scoreRowSwap(board, 0, 5); // hestur
    expect(result.playerAWords.map((w) => w.word)).toEqual(["hestur"]);
    expect(deriveReadingDirection(result.playerAWords[0].tiles)).toBe("ltr");
  });
});
