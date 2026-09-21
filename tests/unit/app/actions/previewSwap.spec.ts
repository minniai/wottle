import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn() };
});
vi.mock("@/lib/game-engine/dictionary", () => ({
  loadDictionary: vi.fn().mockResolvedValue(new Set(["hestur", "fár"])),
}));
vi.mock("@/lib/observability/log", () => ({ logPlaytestInfo: vi.fn(), logPlaytestError: vi.fn() }));

import { previewSwap } from "@/app/actions/match/previewSwap";
import { logPlaytestInfo } from "@/lib/observability/log";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const MATCH_ID = "match-1";

function hesturBoard(): string[][] {
  const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "Z"));
  ["R", "E", "S", "T", "U", "H"].forEach((ch, i) => {
    grid[0][i] = ch;
  });
  return grid;
}

function makeSupabaseMock(opts: { frozen?: Record<string, unknown>; state?: string; board?: string[][] } = {}) {
  const writes = vi.fn();
  // Spec 050: the live board is on the match row, as the last resolved move left it.
  const match = {
    state: opts.state ?? "in_progress",
    player_a_id: PLAYER_A,
    player_b_id: PLAYER_B,
    frozen_tiles: opts.frozen ?? {},
    board: (opts.board ?? hesturBoard()).map((r) => r.map((c) => c.toLowerCase())),
  };
  return {
    writes,
    from: vi.fn((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        insert: writes,
        update: writes,
        upsert: writes,
        delete: writes,
        then: undefined as unknown,
      };
      if (table === "matches") chain.single.mockResolvedValue({ data: match, error: null });
      return chain;
    }),
  };
}

describe("previewSwap", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockReset();
    vi.mocked(getServiceRoleClient).mockReset();
    vi.mocked(assertWithinRateLimit).mockClear();
    vi.mocked(logPlaytestInfo).mockClear();
  });

  it("returns unauthenticated without a session for both variants (Q5)", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    expect((await previewSwap({ kind: "warmup", board: hesturBoard(), from: { x: 0, y: 0 }, to: { x: 5, y: 0 } })).status).toBe("unauthenticated");
    expect((await previewSwap({ kind: "match", matchId: MATCH_ID, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } })).status).toBe("unauthenticated");
  });

  it("warm-up variant prices a swap on the submitted board with direction, writing nothing", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: PLAYER_A } } as never);
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as never);

    const result = await previewSwap({ kind: "warmup", board: hesturBoard(), from: { x: 0, y: 0 }, to: { x: 5, y: 0 } });

    expect(result.status).toBe("ok");
    expect(result.words).toEqual([{ word: "hestur", points: expect.any(Number), direction: "ltr" }]);
    expect(result.total).toBe(result.words![0].points);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(assertWithinRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: "match:preview-swap", identifier: PLAYER_A }));
    expect(logPlaytestInfo).toHaveBeenCalledWith("preview-swap.priced", expect.objectContaining({ metadata: expect.objectContaining({ wordCount: 1 }) }));
  });

  it("warm-up variant rejects a malformed board and a self-swap", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: PLAYER_A } } as never);
    const bad = hesturBoard();
    bad[0][0] = "1";
    expect((await previewSwap({ kind: "warmup", board: bad, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } })).status).toBe("rejected");
    expect((await previewSwap({ kind: "warmup", board: hesturBoard(), from: { x: 0, y: 0 }, to: { x: 0, y: 0 } })).status).toBe("rejected");
    expect((await previewSwap({ kind: "warmup", board: hesturBoard().slice(0, 9), from: { x: 0, y: 0 }, to: { x: 1, y: 0 } })).status).toBe("rejected");
  });

  it("match variant prices on the live board and never writes", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: PLAYER_A } } as never);
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as never);

    const result = await previewSwap({ kind: "match", matchId: MATCH_ID, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } });

    expect(result.status).toBe("ok");
    expect(result.words?.[0].word).toBe("hestur");
    expect(supabase.writes).not.toHaveBeenCalled();
  });

  it("match variant rejects a swap touching a frozen tile", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: PLAYER_A } } as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(makeSupabaseMock({ frozen: { "0,0": { owner: "player_b" } } }) as never);

    const result = await previewSwap({ kind: "match", matchId: MATCH_ID, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } });
    expect(result.status).toBe("rejected");
  });

  it("match variant prices on the board as the last resolved move left it (spec 050): a swap that only works after the opponent's move works once it has resolved", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: PLAYER_A } } as never);
    // Row: r e s t z h — hestur needs the u the opponent's move has not yet brought in.
    const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "Z"));
    ["R", "E", "S", "T", "Z", "H"].forEach((ch, i) => {
      grid[0][i] = ch;
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(makeSupabaseMock({ board: grid }) as never);
    const before = await previewSwap({ kind: "match", matchId: MATCH_ID, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } });
    expect(before.words).toEqual([]);

    const after = grid.map((r) => [...r]);
    after[0][4] = "U";
    vi.mocked(getServiceRoleClient).mockReturnValue(makeSupabaseMock({ board: after }) as never);
    const result = await previewSwap({ kind: "match", matchId: MATCH_ID, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } });
    expect(result.status).toBe("ok");
    expect(result.words?.[0].word).toBe("hestur");
  });

  it("match variant returns forbidden for a non-participant and rejected for an ended match", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: "stranger" } } as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    expect((await previewSwap({ kind: "match", matchId: MATCH_ID, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } })).status).toBe("forbidden");

    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: PLAYER_A } } as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(makeSupabaseMock({ state: "completed" }) as never);
    expect((await previewSwap({ kind: "match", matchId: MATCH_ID, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } })).status).toBe("rejected");
  });
});
