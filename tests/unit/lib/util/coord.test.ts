import { describe, expect, test } from "vitest";

import { formatCoord } from "@/lib/util/coord";

describe("formatCoord", () => {
  test("returns A1 for (0, 0)", () => {
    expect(formatCoord(0, 0)).toBe("A1");
  });

  test("returns J10 for (9, 9)", () => {
    expect(formatCoord(9, 9)).toBe("J10");
  });

  test("returns E7 for (4, 6)", () => {
    expect(formatCoord(4, 6)).toBe("E7");
  });

  test("throws on out-of-range x", () => {
    expect(() => formatCoord(10, 0)).toThrow(/column/i);
    expect(() => formatCoord(-1, 0)).toThrow(/column/i);
  });

  test("throws on out-of-range y", () => {
    expect(() => formatCoord(0, 10)).toThrow(/row/i);
    expect(() => formatCoord(0, -1)).toThrow(/row/i);
  });
});
