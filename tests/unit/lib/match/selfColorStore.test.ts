import { beforeEach, describe, expect, test } from "vitest";

import { useSelfColorStore } from "@/lib/match/selfColorStore";

describe("selfColorStore", () => {
  beforeEach(() => {
    useSelfColorStore.getState().clearSelfColor();
  });

  test("defaults to null", () => {
    expect(useSelfColorStore.getState().selfColor).toBeNull();
  });

  test("setSelfColor stores the current player's match color", () => {
    useSelfColorStore.getState().setSelfColor("var(--p2)");
    expect(useSelfColorStore.getState().selfColor).toBe("var(--p2)");
  });

  test("clearSelfColor resets to null", () => {
    useSelfColorStore.getState().setSelfColor("var(--p1)");
    useSelfColorStore.getState().clearSelfColor();
    expect(useSelfColorStore.getState().selfColor).toBeNull();
  });
});
