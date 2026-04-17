import { describe, expect, test } from "vitest";

import { generateAvatar } from "@/lib/ui/avatarGradient";

describe("generateAvatar", () => {
  test("is deterministic for the same playerId + displayName", () => {
    const a = generateAvatar("abc-123", "Ari");
    const b = generateAvatar("abc-123", "Ari");
    expect(a).toEqual(b);
  });

  test("differs for different playerIds", () => {
    const a = generateAvatar("player-1", "Ari");
    const b = generateAvatar("player-2", "Ari");
    expect(a.background).not.toEqual(b.background);
  });

  test("extracts initials from a single word", () => {
    expect(generateAvatar("id", "Hestur").initials).toBe("HE");
  });

  test("extracts initials from two words (space-separated)", () => {
    expect(generateAvatar("id", "Ari Johannesson").initials).toBe("AJ");
  });

  test("preserves Icelandic diacritics in initials", () => {
    expect(generateAvatar("id", "Örvar").initials).toBe("ÖR");
    expect(generateAvatar("id", "Þór").initials).toBe("ÞÓ");
  });

  test("falls back to '?' for empty displayName", () => {
    expect(generateAvatar("id", "").initials).toBe("?");
  });

  test("returns a linear-gradient background string", () => {
    expect(generateAvatar("id", "x").background).toMatch(/^linear-gradient\(/);
  });

  test("uses cream foreground for dark gradient (WCAG AA contrast)", () => {
    // Gradient lightness range is 30%-45% — always dark enough for cream text
    expect(generateAvatar("id", "x").foreground).toBe("#F2EAD3");
  });
});
