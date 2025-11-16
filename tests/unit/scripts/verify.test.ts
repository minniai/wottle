vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createClient } from "@supabase/supabase-js";

import { PRIMARY_BOARD_ID } from "../../../scripts/supabase/constants";
import { verifySupabase } from "../../../scripts/supabase/verify";
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

describe("verifySupabase instrumentation", () => {
  test("reports healthy status with duration when probe succeeds", async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(250);
    const probe = vi.fn().mockResolvedValue(undefined);

    const result = await verifySupabase({ now, probe });

    expect(probe).toHaveBeenCalled();
    expect(result.status).toBe("healthy");
    expect(result.durationMs).toBe(150);
    expect(result).not.toHaveProperty("message");
  });

  test("reports error status and message when probe fails", async () => {
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(400);
    const failure = new Error("supabase is misconfigured");

    const result = await verifySupabase({
      now,
      probe: vi.fn().mockRejectedValue(failure),
    });

    expect(result.status).toBe("error");
    expect(result.durationMs).toBe(400);
    expect(result.message).toBe("supabase is misconfigured");
  });

  test("runs the default probe with structured Supabase query", async () => {
    const stub = createSupabaseClientStub({
      boardLimitResponses: [{ error: null }],
    });
    createClientMock.mockReturnValueOnce(asSupabaseClient(stub));

    const result = await verifySupabase();

    expect(createClientMock).toHaveBeenCalledWith(
      "http://localhost:54321",
      "service-role-key",
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      })
    );

    expect(stub.history.fromTables).toEqual([
      "boards",
      "players",
      "matches",
      "rounds",
      "move_submissions",
      "match_logs",
    ]);
    expect(stub.history.boardSelectColumns).toEqual(["board_id"]);
    expect(stub.history.boardSelectFilters).toEqual([
      { column: "board_id", value: PRIMARY_BOARD_ID },
    ]);
    expect(stub.history.boardLimitValues).toEqual([1]);
    expect(result.status).toBe("healthy");
  });
});

