import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sessionSecret", () => ({ requireSessionSecret: () => "secret" }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: () => {
    throw new Error("no client");
  },
}));

import { pokePlayers } from "@/lib/realtime/pokes";

/** Spec 070 US9: a poke is a hint to re-read; it never fails the act that sent it. */
describe("pokes", () => {
  it("resolve and log when the client cannot be made", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(pokePlayers(["p1", "p2"], "match")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("poke.failed"));
  });
});
