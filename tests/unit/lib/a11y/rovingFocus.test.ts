import { describe, expect, it } from "vitest";

import { getNextRovingIndex } from "@/lib/a11y/rovingFocus";

describe("getNextRovingIndex", () => {
  it("wraps to the next or previous index for arrow keys", () => {
    expect(getNextRovingIndex(0, 3, "ArrowRight")).toBe(1);
    expect(getNextRovingIndex(2, 3, "ArrowRight")).toBe(0);
    expect(getNextRovingIndex(0, 3, "ArrowLeft")).toBe(2);
    expect(getNextRovingIndex(1, 3, "ArrowLeft")).toBe(0);
  });

  it("treats ArrowDown like ArrowRight and ArrowUp like ArrowLeft", () => {
    expect(getNextRovingIndex(0, 4, "ArrowDown")).toBe(1);
    expect(getNextRovingIndex(0, 4, "ArrowUp")).toBe(3);
  });

  it("jumps to the start or end for Home/End keys", () => {
    expect(getNextRovingIndex(2, 5, "Home")).toBe(0);
    expect(getNextRovingIndex(1, 5, "End")).toBe(4);
  });

  it("returns the current index for unsupported keys or empty lists", () => {
    expect(getNextRovingIndex(1, 0, "ArrowRight")).toBe(1);
    expect(getNextRovingIndex(1, 3, "Enter")).toBe(1);
  });
});


