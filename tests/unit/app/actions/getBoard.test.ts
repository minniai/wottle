import { beforeEach, describe, expect, test, vi } from "vitest";

import type { BoardGrid } from "../../../../lib/types/board";
import { getBoard } from "../../../../app/actions/getBoard";
import { PRIMARY_BOARD_ID } from "../../../../scripts/supabase/constants";
import { getServiceRoleClient } from "../../../../lib/supabase/server";
import { BOARD_SIZE } from "../../../../lib/constants/board";

vi.mock("../../../../lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));

type MaybeSingleResult = {
  data: unknown;
  error: Error | null;
};

function createGrid(): BoardGrid {
  return Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) =>
      String.fromCharCode(65 + ((x + y) % 26))
    )
  );
}

function mockSupabase(result: MaybeSingleResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const queryBuilder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: typeof maybeSingle;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  const from = vi.fn(() => queryBuilder);

  vi.mocked(getServiceRoleClient).mockReturnValue({ from } as never);

  return { from, queryBuilder, maybeSingle };
}

describe("getBoard server action", () => {
  beforeEach(() => {
    vi.mocked(getServiceRoleClient).mockReset();
  });

  test("returns the board grid from Supabase", async () => {
    const grid = createGrid();
    const boardId = "7f4b52b4-5957-41f7-86cb-ff525bd0c0f4";

    const { from, queryBuilder } = mockSupabase({
      data: { id: boardId, board_id: PRIMARY_BOARD_ID, grid },
      error: null,
    });

    const result = await getBoard();

    expect(result.boardId).toBe(boardId);
    expect(result.grid).toEqual(grid);
    expect(from).toHaveBeenCalledWith("boards");
    expect(queryBuilder.select).toHaveBeenCalledWith("id, board_id, grid, updated_at");
    expect(queryBuilder.eq).toHaveBeenCalledWith("board_id", PRIMARY_BOARD_ID);
  });

  test("throws when Supabase returns an error", async () => {
    mockSupabase({
      data: null,
      error: new Error("database unavailable"),
    });

    await expect(getBoard()).rejects.toThrow(/failed to load board/i);
  });

  test("throws when the board row is missing", async () => {
    mockSupabase({
      data: null,
      error: null,
    });

    await expect(getBoard()).rejects.toThrow(/could not find board/i);
  });

  test("validates the grid shape before returning", async () => {
    mockSupabase({
      data: { id: "123", board_id: PRIMARY_BOARD_ID, grid: [] },
      error: null,
    });

    await expect(getBoard()).rejects.toThrow(/invalid board grid/i);
  });
});


