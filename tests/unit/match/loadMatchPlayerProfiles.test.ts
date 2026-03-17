import { describe, it, expect, vi } from "vitest";
import { loadMatchPlayerProfiles } from "@/lib/match/stateLoader";

function createMockClient(players: any[] | null, error: any = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: players, error }),
      }),
    }),
  } as any;
}

describe("loadMatchPlayerProfiles", () => {
  const playerAId = "aaa-111";
  const playerBId = "bbb-222";

  it("should return both player profiles mapped from DB rows", async () => {
    const client = createMockClient([
      {
        id: playerAId,
        username: "alice",
        display_name: "Alice W",
        avatar_url: "https://example.com/alice.png",
        elo_rating: 1350,
      },
      {
        id: playerBId,
        username: "bob",
        display_name: "Bob X",
        avatar_url: null,
        elo_rating: 1200,
      },
    ]);

    const result = await loadMatchPlayerProfiles(client, playerAId, playerBId);

    expect(result).toEqual({
      playerA: {
        playerId: playerAId,
        displayName: "Alice W",
        username: "alice",
        avatarUrl: "https://example.com/alice.png",
        eloRating: 1350,
      },
      playerB: {
        playerId: playerBId,
        displayName: "Bob X",
        username: "bob",
        avatarUrl: null,
        eloRating: 1200,
      },
    });
  });

  it("should use username as displayName fallback when display_name is empty", async () => {
    const client = createMockClient([
      {
        id: playerAId,
        username: "alice",
        display_name: "",
        avatar_url: null,
        elo_rating: 1200,
      },
      {
        id: playerBId,
        username: "bob",
        display_name: "Bob",
        avatar_url: null,
        elo_rating: 1200,
      },
    ]);

    const result = await loadMatchPlayerProfiles(client, playerAId, playerBId);

    expect(result.playerA.displayName).toBe("alice");
    expect(result.playerB.displayName).toBe("Bob");
  });

  it("should default eloRating to 1200 when null", async () => {
    const client = createMockClient([
      {
        id: playerAId,
        username: "alice",
        display_name: "Alice",
        avatar_url: null,
        elo_rating: null,
      },
      {
        id: playerBId,
        username: "bob",
        display_name: "Bob",
        avatar_url: null,
        elo_rating: null,
      },
    ]);

    const result = await loadMatchPlayerProfiles(client, playerAId, playerBId);

    expect(result.playerA.eloRating).toBe(1200);
    expect(result.playerB.eloRating).toBe(1200);
  });

  it("should return fallback profiles when query fails", async () => {
    const client = createMockClient(null, { message: "DB error" });

    const result = await loadMatchPlayerProfiles(client, playerAId, playerBId);

    expect(result.playerA.playerId).toBe(playerAId);
    expect(result.playerA.displayName).toBe("Player A");
    expect(result.playerB.playerId).toBe(playerBId);
    expect(result.playerB.displayName).toBe("Player B");
  });
});
