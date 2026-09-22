/**
 * Spec 060 FR-014: the resolver plays a match in its own language. The claim
 * carries `matches.language`; an English match loads the English dictionary and
 * scores with English letter values, an Icelandic one is unchanged.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/match/movePublisher", () => ({ publishMoveResolved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/integrityCheck", () => ({ checkMoveIntegrity: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/game-engine/dictionary", () => ({
  loadDictionary: vi.fn(async (language: string) => new Set(language === "en" ? ["cats"] : ["hestur"])),
}));

import { loadDictionary } from "@/lib/game-engine/dictionary";
import { resolvePendingMoves } from "@/lib/match/moveResolver";

import { blankBoard, claim, connectTestDb, createTestMatch, dropTestMatch, readMatch, receive, type TestMatch } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("a match resolves in its own language (spec 060)", () => {
  let match: TestMatch | undefined;
  afterEach(async () => {
    if (match) await dropTestMatch(db!, match);
    match = undefined;
    vi.mocked(loadDictionary).mockClear();
  });

  it("claim_next_move carries the match's language", async () => {
    match = await createTestMatch(db!, { language: "en" });
    await receive(db!, match, match.playerAId);
    const claimed = await claim(db!, match.matchId);
    expect(claimed?.match.language).toBe("en");
  });

  it("an English match scores an English word with English values", async () => {
    const board = blankBoard();
    ["c", "a", "t"].forEach((ch, i) => (board[0][i] = ch));
    board[1][3] = "s";
    match = await createTestMatch(db!, { board, language: "en" });
    expect((await receive(db!, match, match.playerAId, { x: 3, y: 0, tx: 3, ty: 1, to: "s" })).status).toBe("accepted");

    await resolvePendingMoves(match.matchId);

    expect(loadDictionary).toHaveBeenCalledWith("en");
    // C3 + A1 + T1 + S1 = 6, + (4 − 2) × 5 = 16.
    expect(await readMatch(db!, match.matchId)).toMatchObject({ player_a_score: 16, player_a_moves: 1 });
  });

  it("an Icelandic match is unchanged: the Icelandic dictionary, no English word", async () => {
    const board = blankBoard();
    ["c", "a", "t"].forEach((ch, i) => (board[0][i] = ch));
    board[1][3] = "s";
    match = await createTestMatch(db!, { board });
    await receive(db!, match, match.playerAId, { x: 3, y: 0, tx: 3, ty: 1, to: "s" });

    await resolvePendingMoves(match.matchId);

    expect(loadDictionary).toHaveBeenCalledWith("is");
    expect(await readMatch(db!, match.matchId)).toMatchObject({ player_a_score: -5, player_a_moves: 1 });
  });
});
