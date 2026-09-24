import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/match/rematchBroadcast", () => ({ broadcastRematchEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/match/logWriter", () => ({ writeMatchLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/realtime/pokes", () => ({ pokePlayers: vi.fn(async () => undefined) }));

import { announceRematch } from "@/lib/match/rematchAnnouncements";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import { pokePlayers } from "@/lib/realtime/pokes";

describe("announceRematch (spec 070 US9, FR-034)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no broadcast carries the new match id, and both players are poked with `rematch`", async () => {
    await announceRematch({} as never, { matchId: "m1", requesterId: "birna", newMatchId: "m2", players: ["birna", "kari"] });
    const event = vi.mocked(broadcastRematchEvent).mock.calls[0][1];
    expect(event).toEqual({ type: "rematch-accepted", matchId: "m1", requesterId: "birna", status: "accepted" });
    expect(JSON.stringify(vi.mocked(broadcastRematchEvent).mock.calls)).not.toContain("m2");
    expect(pokePlayers).toHaveBeenCalledWith(["birna", "kari"], "rematch");
  });
});
