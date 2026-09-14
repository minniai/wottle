/**
 * Integration: the preview path is side-effect free against the match tables.
 * Uses the mocked Supabase client pattern of this folder (no live DB) and a
 * stub dictionary; asserts every table access is a read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn() };
});
vi.mock("@/lib/game-engine/dictionary", () => ({ loadDictionary: vi.fn().mockResolvedValue(new Set(["hestur"])) }));

import { previewSwap } from "@/app/actions/match/previewSwap";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const PLAYER_A = "player-a";

describe("previewSwap integration — read-only", () => {
  const accessed: Array<{ table: string; op: string }> = [];

  beforeEach(() => {
    accessed.length = 0;
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: PLAYER_A } } as never);
    const board = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "z"));
    ["r", "e", "s", "t", "u", "h"].forEach((ch, i) => (board[0][i] = ch));
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: (table: string) => {
        const record = (op: string) => accessed.push({ table, op });
        const chain: Record<string, unknown> = {};
        for (const op of ["select", "eq"]) {
          chain[op] = vi.fn(() => {
            record(op);
            return chain;
          });
        }
        for (const op of ["insert", "update", "upsert", "delete"]) {
          chain[op] = vi.fn(() => {
            record(op);
            return chain;
          });
        }
        chain.single = vi.fn(async () => {
          record("single");
          if (table === "matches") return { data: { current_round: 1, state: "in_progress", player_a_id: PLAYER_A, player_b_id: "player-b", frozen_tiles: {} }, error: null };
          if (table === "rounds") return { data: { id: "round-1", board_snapshot_before: board }, error: null };
          return { data: null, error: null };
        });
        if (table === "move_submissions") {
          chain.eq = vi.fn(async () => {
            record("eq");
            return { data: [], error: null };
          });
        }
        return chain;
      },
    } as never);
  });

  it("prices a match swap using only reads on matches, rounds and move_submissions", async () => {
    const result = await previewSwap({ kind: "match", matchId: "m", from: { x: 0, y: 0 }, to: { x: 5, y: 0 } });
    expect(result.status).toBe("ok");
    expect(result.total).toBeGreaterThan(0);
    const writes = accessed.filter((a) => ["insert", "update", "upsert", "delete"].includes(a.op));
    expect(writes).toEqual([]);
    expect(accessed.some((a) => a.table === "word_score_entries")).toBe(false);
    expect(new Set(accessed.map((a) => a.table))).toEqual(new Set(["matches", "rounds", "move_submissions"]));
  });
});
