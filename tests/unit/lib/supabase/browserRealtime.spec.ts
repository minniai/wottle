import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

/** Spec 070 FR-037, research R6: the socket's keep-alive runs in a worker, so a background tab stays joined. */
describe("browser Supabase client (spec 070)", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("asks Realtime for a worker heartbeat", async () => {
    const { getBrowserSupabaseClient } = await import("@/lib/supabase/browser");
    getBrowserSupabaseClient();
    expect(createClient).toHaveBeenCalledWith(
      "http://localhost:54321",
      "anon",
      expect.objectContaining({ realtime: expect.objectContaining({ worker: true }) }),
    );
  });
});
