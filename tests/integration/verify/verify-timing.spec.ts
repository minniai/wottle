import { describe, expect, test, vi } from "vitest";

import { verifySupabase } from "@/scripts/supabase/verify";

describe("verifySupabase instrumentation", () => {
  test("reports healthy status within 10s", async () => {
    const fakeNow = vi.fn();
    fakeNow.mockReturnValueOnce(0).mockReturnValueOnce(7_500);

    const result = await verifySupabase({
      now: fakeNow,
      probe: async () => {
        // Simulate asynchronous Supabase health check that finishes quickly.
        await new Promise((resolve) => setTimeout(resolve, 1));
      },
    });

    expect(result.status).toBe("healthy");
    expect(result.durationMs).toBeLessThanOrEqual(10_000);
  });
});
