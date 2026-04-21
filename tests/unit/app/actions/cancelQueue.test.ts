import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));

import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const SESSION = {
  token: "tok",
  player: { id: "player-1", username: "alice", displayName: "Alice" },
  issuedAt: Date.now(),
};

function buildPlayersTable(status: string | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: status !== null ? { status } : null,
          error: null,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  };
}

let playersTable: ReturnType<typeof buildPlayersTable>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cancelQueueAction", () => {
  test("returns unauthenticated when no session", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const result = await cancelQueueAction();

    expect(result.status).toBe("unauthenticated");
    expect(result.message).toBeTruthy();
  });

  test("returns in_match and does NOT update when player status is in_match", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    playersTable = buildPlayersTable("in_match");
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue(playersTable),
    } as never);

    const result = await cancelQueueAction();

    expect(result.status).toBe("in_match");
    expect(playersTable.update).not.toHaveBeenCalled();
  });

  test("returns cancelled and issues guarded update when player is matchmaking", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    playersTable = buildPlayersTable("matchmaking");
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue(playersTable),
    } as never);

    const result = await cancelQueueAction();

    expect(result.status).toBe("cancelled");
    expect(playersTable.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "available" }),
    );
    const inSpy = playersTable.update().eq().in as ReturnType<typeof vi.fn>;
    expect(inSpy).toHaveBeenCalledWith("status", ["matchmaking", "available"]);
  });

  test("returns cancelled when player is already available", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    playersTable = buildPlayersTable("available");
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue(playersTable),
    } as never);

    const result = await cancelQueueAction();

    expect(result.status).toBe("cancelled");
    expect(playersTable.update).toHaveBeenCalled();
  });

  test("returns error with message when supabase throws", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    vi.mocked(getServiceRoleClient).mockImplementation(() => {
      throw new Error("db connection failed");
    });

    const result = await cancelQueueAction();

    expect(result.status).toBe("error");
    expect(result.message).toBe("db connection failed");
  });
});
