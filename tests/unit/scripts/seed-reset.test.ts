vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createClient } from "@supabase/supabase-js";

import { BASELINE_GRID, PRIMARY_BOARD_ID } from "../../../scripts/supabase/constants";
import { resetBoard } from "../../../scripts/supabase/reset";
import { seedBoard } from "../../../scripts/supabase/seed";
import * as seedModule from "../../../scripts/supabase/seed";
import { createSupabaseClientStub } from "../../helpers/supabaseClientStub";

const createClientMock = vi.mocked(createClient);
const originalEnv = { ...process.env };

function asSupabaseClient(stub: ReturnType<typeof createSupabaseClientStub>) {
  return stub.client as unknown as ReturnType<typeof createClient>;
}

beforeEach(() => {
  createClientMock.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

afterEach(() => {
  if (originalEnv.NEXT_PUBLIC_SUPABASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
  }

  if (originalEnv.SUPABASE_SERVICE_ROLE_KEY === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  }
});

describe("seedBoard", () => {
  test("fails fast when Supabase URL env var is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await expect(seedBoard()).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  test("inserts the baseline grid when the board does not yet exist", async () => {
    const stub = createSupabaseClientStub({
      boardFetchResponses: [
        { data: null, error: null },
        { data: { id: "new-board-id" }, error: null },
      ],
    });

    createClientMock.mockReturnValueOnce(asSupabaseClient(stub));

    const result = await seedBoard();

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(createClientMock).toHaveBeenCalledWith(
      "http://localhost:54321",
      "service-role-key",
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      })
    );
    expect(stub.history.boardInsertPayloads).toHaveLength(1);
    expect(stub.history.boardInsertPayloads[0]).toEqual({
      board_id: PRIMARY_BOARD_ID,
      grid: BASELINE_GRID,
    });
    expect(stub.history.movesDeleteFilters).toEqual([
      { column: "board_id", value: "new-board-id" },
    ]);
  });

  test("updates the existing board grid and clears moves", async () => {
    const stub = createSupabaseClientStub({
      boardFetchResponses: [{ data: { id: "existing-board-id" }, error: null }],
    });

    createClientMock.mockReturnValueOnce(asSupabaseClient(stub));

    await seedBoard();

    expect(stub.history.boardUpdatePayloads).toEqual([
      { grid: BASELINE_GRID },
    ]);
    expect(stub.history.boardInsertPayloads).toHaveLength(0);
    expect(stub.history.movesDeleteFilters).toEqual([
      { column: "board_id", value: "existing-board-id" },
    ]);
  });
});

describe("resetBoard", () => {
  test("rehydrates Supabase by delegating to seedBoard when the board is missing", async () => {
    const resetStub = createSupabaseClientStub({
      boardFetchResponses: [{ data: null, error: null }],
    });
    const seedStub = createSupabaseClientStub({
      boardFetchResponses: [
        { data: null, error: null },
        { data: { id: "seeded-board-id" }, error: null },
      ],
    });

    createClientMock
      .mockReturnValueOnce(asSupabaseClient(resetStub))
      .mockReturnValueOnce(asSupabaseClient(seedStub));

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await resetBoard();
    } finally {
      consoleSpy.mockRestore();
    }

    expect(seedStub.history.boardInsertPayloads).toHaveLength(1);
    expect(seedStub.history.movesDeleteFilters).toEqual([
      { column: "board_id", value: "seeded-board-id" },
    ]);
  });

  test("resets the existing board grid and clears associated moves", async () => {
    const stub = createSupabaseClientStub({
      boardFetchResponses: [{ data: { id: "existing-board-id" }, error: null }],
    });
    createClientMock.mockReturnValueOnce(asSupabaseClient(stub));

    const seedSpy = vi
      .spyOn(seedModule, "seedBoard")
      .mockResolvedValue({ durationMs: 0 });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await resetBoard();
    } finally {
      consoleSpy.mockRestore();
      seedSpy.mockRestore();
    }

    expect(seedSpy).not.toHaveBeenCalled();
    expect(stub.history.boardUpdatePayloads).toEqual([
      { grid: BASELINE_GRID },
    ]);
    expect(stub.history.movesDeleteFilters).toEqual([
      { column: "board_id", value: "existing-board-id" },
    ]);
  });
});

