import { describe, expect, test } from "vitest";

import { bootstrapMatchRecord, type MatchBootstrapInput } from "@/lib/matchmaking/service";

type Payload = Record<string, unknown>;

function fakeClient(written: Payload[]) {
  return {
    from: () => ({
      upsert: (payload: Payload) => {
        written.push(payload);
        return { select: () => ({ single: async () => ({ data: { id: "m1" }, error: null }) }) };
      },
    }),
  } as never;
}

/**
 * Spec 048 US6 (supersedes spec 045 decision 1): there is one kind of match.
 * Nothing writes `matches.rated`; the column keeps its default.
 */
describe("rated only", () => {
  test("bootstrapMatchRecord never writes a rated column", async () => {
    const written: Payload[] = [];
    await bootstrapMatchRecord(fakeClient(written), { boardSeed: "s", playerAId: "a", playerBId: "b", rematchOf: "m0" });
    expect(written[0]).not.toHaveProperty("rated");
  });

  test("the bootstrap input has no rated field", () => {
    const input: MatchBootstrapInput = { boardSeed: "s", playerAId: "a", playerBId: "b" };
    expect("rated" in input).toBe(false);
    // @ts-expect-error — the field is gone with the unranked branch.
    const stale: MatchBootstrapInput = { boardSeed: "s", playerAId: "a", playerBId: "b", rated: false };
    expect(stale).toBeTruthy();
  });
});
