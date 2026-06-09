import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));

vi.mock("@/app/actions/match/publishRoundSummary", () => ({
  computeWordScoresForRound: vi.fn(),
}));

vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/observability/instantScoring", () => ({
  trackInstantScoringFired: vi.fn(),
  trackInstantScoringDeferred: vi.fn(),
  trackInstantScoringFailed: vi.fn(),
}));

import { computeWordScoresForRound } from "@/app/actions/match/publishRoundSummary";
import { instantScoreFirstSubmission } from "@/lib/match/instantScoring";
import {
  trackInstantScoringDeferred,
  trackInstantScoringFailed,
  trackInstantScoringFired,
} from "@/lib/observability/instantScoring";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const ROUND_ID = "22222222-2222-2222-2222-222222222222";
const PLAYER_A = "33333333-3333-3333-3333-333333333333";
const PLAYER_B = "44444444-4444-4444-4444-444444444444";
const SUBMITTED_AT = "2026-06-09T12:00:00.000Z";

function createBoard(): string[][] {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => "A"),
  );
}

interface ClientOpts {
  pendingCount: number;
  hasMatch?: boolean;
  hasRound?: boolean;
  firstSubmissionPlayer?: string;
  frozenTiles?: Record<string, unknown>;
}

function makeClient(opts: ClientOpts) {
  const matchData = opts.hasMatch === false
    ? null
    : {
        id: MATCH_ID,
        current_round: 1,
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
        board_seed: "seed-1",
        frozen_tiles: opts.frozenTiles ?? {},
      };
  const roundData = opts.hasRound === false
    ? null
    : {
        id: ROUND_ID,
        state: "collecting",
        board_snapshot_before: createBoard(),
        started_at: new Date().toISOString(),
      };

  const firstMover = opts.firstSubmissionPlayer ?? PLAYER_A;
  const submissionRows = Array.from({ length: opts.pendingCount }, (_, i) => ({
    id: `sub-${i + 1}`,
    player_id: i === 0 ? firstMover : firstMover === PLAYER_A ? PLAYER_B : PLAYER_A,
    from_x: 0,
    from_y: 0,
    to_x: 1,
    to_y: 0,
    submitted_at: SUBMITTED_AT,
    status: "pending",
  }));

  return {
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: matchData, error: null }),
            single: vi.fn().mockResolvedValue({ data: matchData, error: matchData ? null : { message: "not found" } }),
          })),
        };
      }
      if (table === "rounds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: roundData, error: null }),
            single: vi.fn().mockResolvedValue({ data: roundData, error: roundData ? null : { message: "not found" } }),
          })),
        };
      }
      if (table === "move_submissions") {
        const chain: any = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.order = vi.fn(() =>
          Promise.resolve({ data: submissionRows, error: null }),
        );
        return chain;
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }),
  };
}

describe("instantScoreFirstSubmission — happy path (T015)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'fired' when one submission exists and the swap produced scored words", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({ pendingCount: 1 }) as never,
    );

    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [
        {
          playerId: PLAYER_A,
          word: "köttur",
          length: 6,
          lettersPoints: 8,
          bonusPoints: 20,
          totalPoints: 28,
          coordinates: [
            { x: 1, y: 2 },
            { x: 2, y: 2 },
            { x: 3, y: 2 },
            { x: 4, y: 2 },
            { x: 5, y: 2 },
            { x: 6, y: 2 },
          ],
        },
      ],
      finalBoard: createBoard(),
    });

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result.status).toBe("fired");
    expect(computeWordScoresForRound).toHaveBeenCalledOnce();
    expect(publishMatchState).toHaveBeenCalledWith(MATCH_ID);
    expect(trackInstantScoringFired).toHaveBeenCalledOnce();
    const firedCall = vi.mocked(trackInstantScoringFired).mock.calls[0][0];
    expect(firedCall.matchId).toBe(MATCH_ID);
    expect(firedCall.playerId).toBe(PLAYER_A);
    expect(firedCall.wordCount).toBe(1);
    expect(firedCall.durationMs).toBeGreaterThanOrEqual(0);

    if (result.status === "fired") {
      expect(result.partial.firstMoverId).toBe(PLAYER_A);
      expect(result.partial.firstSubmissionAt).toBe(SUBMITTED_AT);
      expect(result.partial.words).toHaveLength(1);
      expect(result.partial.delta.playerA).toBe(28);
      expect(result.partial.delta.playerB).toBe(0);
    }
  });

  it("calls computeWordScoresForRound with ONLY the first mover's accepted move", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({ pendingCount: 1 }) as never,
    );
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [
        {
          playerId: PLAYER_A,
          word: "ek",
          length: 2,
          lettersPoints: 4,
          bonusPoints: 0,
          totalPoints: 4,
          coordinates: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        },
      ],
      finalBoard: createBoard(),
    });

    await instantScoreFirstSubmission(MATCH_ID);

    const call = vi.mocked(computeWordScoresForRound).mock.calls[0];
    const [matchIdArg, roundIdArg, _roundNumber, _board, acceptedMoves] = call;
    expect(matchIdArg).toBe(MATCH_ID);
    expect(roundIdArg).toBe(ROUND_ID);
    expect(acceptedMoves).toHaveLength(1);
    expect(acceptedMoves[0].player_id).toBe(PLAYER_A);
  });

  it("returns 'no-score' and does NOT broadcast when the first swap produces zero scored words", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({ pendingCount: 1 }) as never,
    );
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [],
      finalBoard: createBoard(),
    });

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result.status).toBe("no-score");
    expect(publishMatchState).not.toHaveBeenCalled();
    expect(trackInstantScoringFired).not.toHaveBeenCalled();
    expect(trackInstantScoringFailed).not.toHaveBeenCalled();
    expect(trackInstantScoringDeferred).not.toHaveBeenCalled();
  });

  it("returns 'deferred-to-combined' when two pending submissions already exist (FR-007)", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({ pendingCount: 2 }) as never,
    );

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result.status).toBe("deferred-to-combined");
    expect(computeWordScoresForRound).not.toHaveBeenCalled();
    expect(publishMatchState).not.toHaveBeenCalled();
    expect(trackInstantScoringDeferred).toHaveBeenCalledOnce();
    const deferredCall = vi.mocked(trackInstantScoringDeferred).mock.calls[0][0];
    expect(deferredCall.reason).toBe("race-window");
  });

  it("returns 'deferred-to-combined' / no-submissions when zero pending submissions exist", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({ pendingCount: 0 }) as never,
    );

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result.status).toBe("deferred-to-combined");
    expect(computeWordScoresForRound).not.toHaveBeenCalled();
    expect(publishMatchState).not.toHaveBeenCalled();
  });

  it("attributes the delta to player B when player B is the first mover", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue(
      makeClient({ pendingCount: 1, firstSubmissionPlayer: PLAYER_B }) as never,
    );
    vi.mocked(computeWordScoresForRound).mockResolvedValue({
      wordScores: [
        {
          playerId: PLAYER_B,
          word: "ek",
          length: 2,
          lettersPoints: 4,
          bonusPoints: 0,
          totalPoints: 4,
          coordinates: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        },
      ],
      finalBoard: createBoard(),
    });

    const result = await instantScoreFirstSubmission(MATCH_ID);

    expect(result.status).toBe("fired");
    if (result.status === "fired") {
      expect(result.partial.delta.playerA).toBe(0);
      expect(result.partial.delta.playerB).toBe(4);
      expect(result.partial.firstMoverId).toBe(PLAYER_B);
    }
  });
});
