import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));

import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const SESSION = {
  token: "tok",
  player: { id: "player-ari", username: "ari", displayName: "Ari" },
  issuedAt: Date.now(),
};

const VALID_MATCH_ID = "00000000-0000-0000-0000-000000000001";
const OPP_ID = "00000000-0000-0000-0000-000000000099";

const PLAYER_ROWS = [
  {
    id: SESSION.player.id,
    username: "ari",
    display_name: "Ari J",
    avatar_url: null,
    status: "available",
    last_seen_at: "2026-01-01T00:00:00Z",
    elo_rating: 1200,
  },
  {
    id: OPP_ID,
    username: "bob",
    display_name: "Bob B",
    avatar_url: "https://example.com/bob.png",
    status: "in_match",
    last_seen_at: "2026-01-01T01:00:00Z",
    elo_rating: 1400,
  },
];

function buildSupabase(matchData: unknown, playerData: unknown) {
  const matchesTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: matchData, error: null }),
      }),
    }),
  };

  const playersTable = {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: playerData, error: null }),
    }),
  };

  return {
    from: vi.fn((table: string) =>
      table === "matches" ? matchesTable : playersTable,
    ),
    matchesTable,
    playersTable,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMatchOverviewAction", () => {
  test("returns unauthenticated when no session", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const result = await getMatchOverviewAction({ matchId: VALID_MATCH_ID });

    expect(result.status).toBe("unauthenticated");
  });

  test("returns error with 'Invalid matchId.' when matchId is not a UUID", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);

    const result = await getMatchOverviewAction({ matchId: "not-a-uuid" });

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ status: "error", message: "Invalid matchId." });
  });

  test("returns not_found when no match row exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    const { from } = buildSupabase(null, null);
    vi.mocked(getServiceRoleClient).mockReturnValue({ from } as never);

    const result = await getMatchOverviewAction({ matchId: VALID_MATCH_ID });

    expect(result.status).toBe("not_found");
  });

  test("returns forbidden when session player is not in the match", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    const matchRow = { player_a_id: "other-a", player_b_id: "other-b" };
    const { from } = buildSupabase(matchRow, null);
    vi.mocked(getServiceRoleClient).mockReturnValue({ from } as never);

    const result = await getMatchOverviewAction({ matchId: VALID_MATCH_ID });

    expect(result.status).toBe("forbidden");
  });

  test("returns ok with correct self + opponent when caller is player_a", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    const matchRow = { player_a_id: SESSION.player.id, player_b_id: OPP_ID };
    const { from } = buildSupabase(matchRow, PLAYER_ROWS);
    vi.mocked(getServiceRoleClient).mockReturnValue({ from } as never);

    const result = await getMatchOverviewAction({ matchId: VALID_MATCH_ID });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.self.id).toBe(SESSION.player.id);
    expect(result.self.username).toBe("ari");
    expect(result.self.displayName).toBe("Ari J");
    expect(result.self.eloRating).toBe(1200);
    expect(result.opponent.id).toBe(OPP_ID);
    expect(result.opponent.username).toBe("bob");
    expect(result.opponent.displayName).toBe("Bob B");
    expect(result.opponent.avatarUrl).toBe("https://example.com/bob.png");
  });

  test("returns ok with correct self + opponent when caller is player_b", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    const matchRow = { player_a_id: OPP_ID, player_b_id: SESSION.player.id };
    const { from } = buildSupabase(matchRow, PLAYER_ROWS);
    vi.mocked(getServiceRoleClient).mockReturnValue({ from } as never);

    const result = await getMatchOverviewAction({ matchId: VALID_MATCH_ID });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.self.id).toBe(SESSION.player.id);
    expect(result.opponent.id).toBe(OPP_ID);
  });

  test("returns error with 'Player records missing.' when players query returns fewer than 2 rows", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    const matchRow = { player_a_id: SESSION.player.id, player_b_id: OPP_ID };
    const { from } = buildSupabase(matchRow, [PLAYER_ROWS[0]]);
    vi.mocked(getServiceRoleClient).mockReturnValue({ from } as never);

    const result = await getMatchOverviewAction({ matchId: VALID_MATCH_ID });

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ status: "error", message: "Player records missing." });
  });

  test("returns error when supabase throws", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    vi.mocked(getServiceRoleClient).mockImplementation(() => {
      throw new Error("boom");
    });

    const result = await getMatchOverviewAction({ matchId: VALID_MATCH_ID });

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ status: "error", message: "boom" });
  });
});
