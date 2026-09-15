import { describe, expect, test, vi } from "vitest";

import { bootstrapMatchRecord, isMatchRated } from "@/lib/matchmaking/service";

type Payload = Record<string, unknown>;

/** Captures the row `bootstrapMatchRecord` would write. */
function fakeClient(written: Payload[]) {
  return {
    from: () => ({
      upsert: (payload: Payload) => {
        written.push(payload);
        return { select: () => ({ single: async () => ({ data: { id: "m1" }, error: null }) }) };
      },
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { rated: false }, error: null }) }),
      }),
    }),
  } as never;
}

/**
 * Spec 045 decision 1. The flag is written once at creation and never changed;
 * everything downstream reads it.
 */
describe("matches.rated", () => {
  test("a match is rated unless the caller says otherwise", async () => {
    const written: Payload[] = [];
    await bootstrapMatchRecord(fakeClient(written), { boardSeed: "s", playerAId: "a", playerBId: "b" });
    // Absent, so the column default (true) applies: the queue path is unchanged.
    expect(written[0]).not.toHaveProperty("rated");
  });

  test("a challenge writes it false", async () => {
    const written: Payload[] = [];
    await bootstrapMatchRecord(fakeClient(written), { boardSeed: "s", playerAId: "a", playerBId: "b", rated: false });
    expect(written[0].rated).toBe(false);
  });

  test("isMatchRated reads the source match, so a rematch can inherit it", async () => {
    expect(await isMatchRated(fakeClient([]), "m1")).toBe(false);
  });

  test("a row written before the column existed counts as rated", async () => {
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {}, error: null }) }) }) }),
    } as never;
    expect(await isMatchRated(client, "old")).toBe(true);
  });
});
