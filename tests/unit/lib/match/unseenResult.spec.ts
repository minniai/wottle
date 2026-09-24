import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const client = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: () => client }));

import { markUnseenResult } from "@/lib/match/unseenResult";

/** Spec 070 US8: holding the result for an away player is best effort; it never fails a completion. */
describe("markUnseenResult", () => {
  it("resolves when the database refuses or the client throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    client.rpc.mockResolvedValueOnce({ error: { message: "down" } });
    await expect(markUnseenResult("m1")).resolves.toBeUndefined();
    client.rpc.mockImplementationOnce(() => {
      throw new Error("no client");
    });
    await expect(markUnseenResult("m1")).resolves.toBeUndefined();
  });
});
