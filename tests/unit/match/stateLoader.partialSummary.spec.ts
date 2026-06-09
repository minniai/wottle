import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/scoring/roundSummary", () => ({
  aggregateRoundSummary: vi.fn().mockReturnValue(null),
}));
vi.mock("@/scripts/supabase/generateBoard", () => ({
  generateBoard: vi.fn().mockReturnValue(
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
  ),
}));

import { loadMatchState } from "@/lib/match/stateLoader";

const PLAYER_A = "11111111-1111-1111-1111-111111111111";
const PLAYER_B = "22222222-2222-2222-2222-222222222222";
const MATCH_ID = "33333333-3333-3333-3333-333333333333";
const ROUND_ID = "44444444-4444-4444-4444-444444444444";

interface BuildClientOptions {
  wordEntries: any[];
  submissions: any[];
  roundState?: "collecting" | "resolving" | "completed";
}

function buildClient({ wordEntries, submissions, roundState = "collecting" }: BuildClientOptions) {
  const startedAt = new Date(Date.now() - 5_000).toISOString();
  return {
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 1,
                board_seed: "seed",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 300_000,
                player_b_timer_ms: 300_000,
                frozen_tiles: {},
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        };
      }
      if (table === "rounds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: ROUND_ID,
                state: roundState,
                board_snapshot_before: Array.from({ length: 10 }, () =>
                  Array.from({ length: 10 }, () => "A"),
                ),
                board_snapshot_after: null,
                started_at: startedAt,
                resolution_started_at: null,
              },
              error: null,
            }),
          })),
        };
      }
      if (table === "scoreboard_snapshots") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      if (table === "move_submissions") {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => Promise.resolve({ data: submissions, error: null })),
          order: vi.fn(() => Promise.resolve({ data: submissions, error: null })),
        };
        return chain;
      }
      if (table === "word_score_entries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: wordEntries, error: null }),
            })),
          })),
        };
      }
      if (table === "match_heartbeats") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          upsert: vi.fn().mockResolvedValue({}),
        };
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

describe("loadMatchState — partialSummary hydration (T007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns partialSummary: undefined when no word_score_entries exist for current round", async () => {
    const client = buildClient({ wordEntries: [], submissions: [] });

    const state = await loadMatchState(client as never, MATCH_ID);

    expect(state).not.toBeNull();
    expect(state?.partialSummary ?? undefined).toBeUndefined();
  });

  it("returns a populated partialSummary when only the first mover's word entries exist and round is still collecting", async () => {
    const submittedAt = new Date(Date.now() - 1_000).toISOString();
    const wordEntries = [
      {
        player_id: PLAYER_A,
        word: "köttur",
        length: 6,
        letters_points: 8,
        bonus_points: 20,
        total_points: 28,
        tiles: [
          { x: 1, y: 2 },
          { x: 2, y: 2 },
          { x: 3, y: 2 },
          { x: 4, y: 2 },
          { x: 5, y: 2 },
          { x: 6, y: 2 },
        ],
      },
    ];
    const submissions = [
      {
        player_id: PLAYER_A,
        submitted_at: submittedAt,
        status: "pending",
        from_x: 1,
        from_y: 2,
        to_x: 2,
        to_y: 2,
      },
    ];

    const client = buildClient({ wordEntries, submissions });
    const state = await loadMatchState(client as never, MATCH_ID);

    expect(state?.partialSummary).toBeDefined();
    expect(state?.partialSummary?.firstMoverId).toBe(PLAYER_A);
    expect(state?.partialSummary?.firstSubmissionAt).toBe(submittedAt);
    expect(state?.partialSummary?.words).toHaveLength(1);
    expect(state?.partialSummary?.delta.playerA).toBe(28);
    expect(state?.partialSummary?.delta.playerB).toBe(0);
  });

  it("returns partialSummary: undefined when both players have word entries (combined path already ran)", async () => {
    const wordEntries = [
      {
        player_id: PLAYER_A,
        word: "köttur",
        length: 6,
        letters_points: 8,
        bonus_points: 20,
        total_points: 28,
        tiles: [{ x: 1, y: 2 }],
      },
      {
        player_id: PLAYER_B,
        word: "hundur",
        length: 6,
        letters_points: 6,
        bonus_points: 20,
        total_points: 26,
        tiles: [{ x: 4, y: 4 }],
      },
    ];

    const client = buildClient({ wordEntries, submissions: [] });
    const state = await loadMatchState(client as never, MATCH_ID);

    expect(state?.partialSummary ?? undefined).toBeUndefined();
  });
});
