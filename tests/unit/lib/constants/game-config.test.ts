import { describe, expect, test } from "vitest";

import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

describe("DEFAULT_GAME_CONFIG", () => {
  test("minimumWordLength is 3 to match boardScanner hardcoded floor", () => {
    // boardScanner.ts hardcodes len >= 3 in its inner loop.
    // Keeping the config in sync prevents hasCrossWordViolation from using
    // a lower floor (2) that the scanner can never actually produce.
    expect(DEFAULT_GAME_CONFIG.minimumWordLength).toBe(3);
  });
});
