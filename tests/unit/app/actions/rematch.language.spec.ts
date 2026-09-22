import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 060 FR-013: a rematch is played in the language of the match it follows,
 * whatever address either player is on.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({ bootstrapMatchRecord: vi.fn().mockResolvedValue("m-next") }));

import { bootstrapMatchRecord } from "@/lib/matchmaking/service";
import { createRematchMatch } from "@/lib/match/rematchMatch";

function client(language: string | null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: language === null ? null : { language }, error: null }),
  };
  return { from: vi.fn(() => chain) };
}

describe("createRematchMatch", () => {
  beforeEach(() => {
    vi.mocked(bootstrapMatchRecord).mockClear();
  });

  it("copies the original match's language", async () => {
    await createRematchMatch(client("en") as never, { matchId: "m1", playerAId: "a", playerBId: "b" });
    expect(bootstrapMatchRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ language: "en", rematchOf: "m1", playerAId: "a", playerBId: "b" }));
  });

  it("falls back to Icelandic for a row with no language", async () => {
    await createRematchMatch(client(null) as never, { matchId: "m1", playerAId: "a", playerBId: "b" });
    expect(bootstrapMatchRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ language: "is" }));
  });
});
