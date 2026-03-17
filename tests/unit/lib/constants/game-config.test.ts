import { describe, expect, test } from "vitest";

import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

describe("DEFAULT_GAME_CONFIG", () => {
  test("minimumWordLength is 2 (Icelandic dictionary contains valid 2-letter words like 'AÐ')", () => {
    expect(DEFAULT_GAME_CONFIG.minimumWordLength).toBe(2);
  });
});
