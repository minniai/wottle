import { describe, expect, test } from "vitest";

import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

describe("DEFAULT_GAME_CONFIG", () => {
  test("minimumWordLength is 3 (dictionary has no 2-letter entries)", () => {
    expect(DEFAULT_GAME_CONFIG.minimumWordLength).toBe(3);
  });
});
