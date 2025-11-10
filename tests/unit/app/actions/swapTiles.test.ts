import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MoveRequest } from "../../../../lib/types/board";
import { swapTiles } from "../../../../app/actions/swapTiles";
import { PRIMARY_BOARD_ID } from "../../../../scripts/supabase/constants";
import { getServiceRoleClient } from "../../../../lib/supabase/server";
import { createPerfTimer } from "../../../../lib/observability/perf";
import { BOARD_SIZE } from "../../../../lib/constants/board";

vi.mock("../../../../lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("../../../../lib/observability/perf", () => ({
  createPerfTimer: vi.fn(),
}));

type BoardRow = {
  id: string;
  board_id: string;
  grid: unknown;
};

type SupabaseQueryResult = {
  data: BoardRow | null;
  error: { message: string } | null;
};

type SupabaseUpdateResult = {
  error: { message: string } | null;
};

type SupabaseInsertResult = {
  error: { message: string } | null;
};

interface SupabaseBoardsQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

interface SupabaseBoardsUpdate {
  eq: ReturnType<typeof vi.fn>;
}

interface SupabaseMovesInsert {
  insert: ReturnType<typeof vi.fn>;
}

function createGrid(): string[][] {
  return Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) =>
      String.fromCharCode("A".charCodeAt(0) + ((x + y) % 26))
    )
  );
}

function createPerfStub() {
  return {
    start: vi.fn(),
    success: vi.fn(),
    failure: vi.fn(),
  };
}

function createSupabaseStub(options: {
  queryResult?: SupabaseQueryResult;
  updateResult?: SupabaseUpdateResult;
  insertResult?: SupabaseInsertResult;
  movesInsertResult?: SupabaseInsertResult;
}) {
  const queryResult =
    options.queryResult ??
    ({
      data: {
        id: "board-row-id",
        board_id: PRIMARY_BOARD_ID,
        grid: createGrid(),
      },
      error: null,
    } satisfies SupabaseQueryResult);

  const updateResult = options.updateResult ?? { error: null };
  const insertResult = options.insertResult ?? { error: null };
  const movesInsertResult = options.movesInsertResult ?? { error: null };

  const boardsMaybeSingle = vi.fn(async () => queryResult);
  const boardsEq = vi.fn(() => ({
    maybeSingle: boardsMaybeSingle,
  }));
  const boardsSelect = vi.fn(() => ({
    eq: boardsEq,
  }));

  const boardsUpdateEq = vi.fn(async () => updateResult);
  const boardsUpdate = vi.fn(() => ({
    eq: boardsUpdateEq,
  }));

  const boardsInsert = vi.fn(async () => insertResult);

  const movesInsert = vi.fn(async () => movesInsertResult);

  const from = vi.fn((table: string) => {
    if (table === "boards") {
      return {
        select: boardsSelect,
        update: boardsUpdate,
        insert: boardsInsert,
      };
    }
    if (table === "moves") {
      return {
        insert: movesInsert,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.mocked(getServiceRoleClient).mockReturnValue({
    from,
  } as never);

  return {
    from,
    boardsSelect,
    boardsEq,
    boardsMaybeSingle,
    boardsUpdate,
    boardsUpdateEq,
    boardsInsert,
    movesInsert,
  };
}

describe("swapTiles server action", () => {
  const perfStub = createPerfStub();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPerfTimer).mockReturnValue(perfStub);
  });

  it("applies a swap, updates the board, and records the move", async () => {
    const initialGrid = createGrid();
    const move: MoveRequest = {
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    };

    const supabase = createSupabaseStub({
      queryResult: {
        data: {
          id: "board-row-id",
          board_id: PRIMARY_BOARD_ID,
          grid: initialGrid,
        },
        error: null,
      },
    });

    const expectedGrid = initialGrid.map((row) => [...row]);
    const originalFrom = expectedGrid[move.from.y][move.from.x];
    expectedGrid[move.from.y][move.from.x] = expectedGrid[move.to.y][move.to.x];
    expectedGrid[move.to.y][move.to.x] = originalFrom;

    const result = await swapTiles(move);

    expect(result.status).toBe("accepted");
    expect(result.grid).toEqual(expectedGrid);
    expect(supabase.from).toHaveBeenCalledWith("boards");
    expect(supabase.boardsSelect).toHaveBeenCalledWith("id, board_id, grid");
    expect(supabase.boardsEq).toHaveBeenCalledWith("board_id", PRIMARY_BOARD_ID);
    expect(supabase.boardsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        grid: expectedGrid,
      })
    );
    expect(supabase.boardsUpdateEq).toHaveBeenCalledWith("id", "board-row-id");
    expect(supabase.movesInsert).toHaveBeenCalledWith({
      board_id: "board-row-id",
      from_x: 0,
      from_y: 0,
      to_x: 1,
      to_y: 1,
      result: "accepted",
      error: null,
    });
    expect(perfStub.start).toHaveBeenCalledTimes(1);
    expect(perfStub.success).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
      })
    );
    expect(perfStub.failure).not.toHaveBeenCalled();
  });

  it("rejects invalid swaps without mutating the board", async () => {
    const supabase = createSupabaseStub({});
    const move: MoveRequest = {
      from: { x: 2, y: 2 },
      to: { x: 2, y: 2 },
    };

    const result = await swapTiles(move);

    expect(result.status).toBe("rejected");
    expect(result.error).toMatch(/cannot swap/i);
    expect(supabase.boardsUpdate).not.toHaveBeenCalled();
    expect(supabase.movesInsert).toHaveBeenCalledWith({
      board_id: "board-row-id",
      from_x: 2,
      from_y: 2,
      to_x: 2,
      to_y: 2,
      result: "rejected",
      error: expect.stringMatching(/cannot swap/i),
    });
    expect(perfStub.success).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      })
    );
  });

  it("rejects out-of-range coordinates gracefully", async () => {
    const supabase = createSupabaseStub({});
    const move = {
      from: { x: -1, y: 0 },
      to: { x: 1, y: 1 },
    } as unknown as MoveRequest;

    const result = await swapTiles(move);

    expect(result.status).toBe("rejected");
    expect(result.error).toMatch(/invalid swap request/i);
    expect(supabase.boardsUpdate).not.toHaveBeenCalled();
    expect(supabase.movesInsert).not.toHaveBeenCalled();
    expect(perfStub.success).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      })
    );
  });

  it("throws when the board row cannot be loaded", async () => {
    createSupabaseStub({
      queryResult: { data: null, error: null },
    });

    await expect(
      swapTiles({ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })
    ).rejects.toThrow(/could not load board/i);

    expect(perfStub.failure).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        reason: "board-missing",
      })
    );
  });

  it("throws when the board update fails", async () => {
    createSupabaseStub({
      updateResult: { error: { message: "database unavailable" } },
    });

    await expect(
      swapTiles({ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })
    ).rejects.toThrow(/failed to persist swap/i);

    expect(perfStub.failure).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        reason: "update-failed",
      })
    );
  });
});


