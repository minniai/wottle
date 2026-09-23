/**
 * Spec 069 FR-003, FR-013–FR-015 (T010): the loader never hands out the
 * letters before both players are seated, voids a table whose time has run
 * out, starts a table both sat at, and no longer starts a match by itself.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/match/tableService", () => ({
  voidDueTable: vi.fn(async () => ({ status: "void" })),
  startTableIfSeated: vi.fn(async () => ({ status: "started" })),
}));
vi.mock("@/lib/match/heartbeatRepository", () => ({ findStaleParticipantDetail: vi.fn(async () => null) }));

import { startTableIfSeated, voidDueTable } from "@/lib/match/tableService";
import { loadMatchState } from "@/lib/match/stateLoader";

const A = "player-a";
const B = "player-b";
const BOARD = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "a"));

function matchRow(over: Record<string, unknown> = {}) {
  return {
    id: "m1", state: "pending", board_seed: "seed", board: BOARD, player_a_id: A, player_b_id: B, frozen_tiles: {},
    winner_id: null, ended_reason: null, completed_at: null, created_at: new Date(Date.now() - 5_000).toISOString(),
    started_at: null, deadline_at: null, resolved_seq: 0, player_a_moves: 0, player_b_moves: 0, player_a_score: 0, player_b_score: 0,
    move_limit: 10, language: "is", player_a_seated_at: null, player_b_seated_at: null,
    table_deadline_at: new Date(Date.now() + 15_000).toISOString(), origin: "queue", rematch_of: null, void_reason: null, voided_by: null,
    ...over,
  };
}

/** A Supabase stand-in: every chain resolves to the rows given for its table; `matches` answers each read in turn. */
function clientWith(matchRows: Array<Record<string, unknown>>, ratings: Array<Record<string, unknown>> = []) {
  const rpc = vi.fn();
  const from = vi.fn((table: string) => {
    const result = () => {
      if (table === "matches") return { data: matchRows.length > 1 ? matchRows.shift() : matchRows[0], error: null };
      if (table === "player_ratings") return { data: ratings, error: null };
      return { data: [], error: null };
    };
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) chain[m] = () => chain;
    chain.maybeSingle = async () => result();
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result());
    return chain;
  });
  return { client: { from, rpc } as never, rpc };
}

describe("loadMatchState at the table (spec 069)", () => {
  beforeEach(() => {
    vi.mocked(voidDueTable).mockClear();
    vi.mocked(startTableIfSeated).mockClear();
  });

  it("returns no board, the table and both players' stakes while pending", async () => {
    const { client, rpc } = clientWith([matchRow({ player_a_seated_at: new Date().toISOString() })], [
      { player_id: A, elo_rating: 1204, games_played: 3, wins: 0, losses: 0, draws: 0 },
      { player_id: B, elo_rating: 1187, games_played: 3, wins: 0, losses: 0, draws: 0 },
    ]);
    const state = await loadMatchState(client, "m1");
    expect(state!.board).toBeNull();
    expect(state!.table).toMatchObject({ origin: "queue", voidReason: null });
    expect(state!.table.seats.a).not.toBeNull();
    expect(state!.table.seats.b).toBeNull();
    expect(state!.stakes).toEqual({ [A]: { win: 15, draw: -1, loss: -17 }, [B]: { win: 17, draw: 1, loss: -15 } });
    // It never starts a match by itself (FR-013).
    expect(rpc).not.toHaveBeenCalled();
    expect(voidDueTable).not.toHaveBeenCalled();
  });

  it("voids a table whose time has run out, and returns the void", async () => {
    const due = matchRow({ table_deadline_at: new Date(Date.now() - 1_000).toISOString() });
    const voided = matchRow({ state: "completed", ended_reason: "void", void_reason: "not_seated", voided_by: B, table_deadline_at: due.table_deadline_at });
    const { client } = clientWith([due, voided]);
    const state = await loadMatchState(client, "m1");
    expect(voidDueTable).toHaveBeenCalledWith(expect.objectContaining({ client }), "m1");
    expect(state).toMatchObject({ state: "completed", endedReason: "void", board: null, stakes: null });
    expect(state!.table).toMatchObject({ voidReason: "not_seated", voidedBy: B });
  });

  it("starts a table both players sat at, and returns the board once it runs", async () => {
    const now = new Date().toISOString();
    const full = matchRow({ player_a_seated_at: now, player_b_seated_at: now });
    const running = matchRow({ state: "in_progress", player_a_seated_at: now, player_b_seated_at: now, started_at: now, deadline_at: now });
    const { client } = clientWith([full, running]);
    const state = await loadMatchState(client, "m1");
    expect(startTableIfSeated).toHaveBeenCalledWith(expect.objectContaining({ client }), "m1");
    expect(state!.state).toBe("in_progress");
    expect(state!.board).toEqual(BOARD);
    expect(state!.stakes).toBeNull();
  });
});
