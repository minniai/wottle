import { beforeEach, describe, expect, it, vi } from "vitest";

/** Spec 072 T017: starting a search withdraws the player's link too (FR-004). */
const updates: Array<{ table: string; values: Record<string, unknown>; filters: Array<[string, unknown]> }> = [];
const pokes: Array<[string, string]> = [];

function builder(table: string) {
  const entry = { table, values: {} as Record<string, unknown>, filters: [] as Array<[string, unknown]> };
  const chain = {
    update(values: Record<string, unknown>) {
      entry.values = values;
      updates.push(entry);
      return chain;
    },
    eq(column: string, value: unknown) {
      entry.filters.push([column, value]);
      return chain;
    },
    select: () => Promise.resolve({ data: table === "match_links" ? [{ id: "l1" }] : [], error: null }),
  };
  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: () => ({ from: builder }) }));
vi.mock("@/lib/realtime/pokes", () => ({
  pokePlayer: async (id: string, kind: string) => void pokes.push([id, kind]),
  pokePlayers: async (ids: string[], kind: string) => void ids.forEach((id) => pokes.push([id, kind])),
}));
vi.mock("@/lib/match/createMatch", () => ({ acceptInvite: vi.fn() }));
vi.mock("@/lib/match/tableService", () => ({ startTableIfSeated: vi.fn() }));

const { withdrawOutgoing } = await import("@/lib/matchmaking/challengeService");

describe("withdrawOutgoing (spec 072)", () => {
  beforeEach(() => {
    updates.length = 0;
    pokes.length = 0;
  });

  it("withdraws the pending link and pokes the sender", async () => {
    await withdrawOutgoing("birna");
    const link = updates.find((u) => u.table === "match_links");
    expect(link?.values.status).toBe("withdrawn");
    expect(link?.filters).toEqual([["sender_id", "birna"], ["status", "pending"]]);
    expect(pokes).toContainEqual(["birna", "link"]);
    expect(updates.some((u) => u.table === "match_invitations")).toBe(true);
  });
});
