import { describe, expect, test } from "vitest";

import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

describe("DEFAULT_GAME_CONFIG", () => {
  test("minimumWordLength is 3 (PRD §1.2 — valid word is 3 or more letters)", () => {
    expect(DEFAULT_GAME_CONFIG.minimumWordLength).toBe(3);
  });
});
