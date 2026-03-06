import { describe, expect, test } from "vitest";

import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

describe("DEFAULT_GAME_CONFIG", () => {
  test("minimumWordLength is 2 per FR-001 (2-letter words are valid)", () => {
    expect(DEFAULT_GAME_CONFIG.minimumWordLength).toBe(2);
  });
});
