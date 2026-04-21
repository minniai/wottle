import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/matchmaking/service")
  >("@/lib/matchmaking/service");
  return { ...actual, findActiveMatchForPlayer: vi.fn() };
});

import { healStuckInMatchStatus } from "@/lib/matchmaking/profile";
import { findActiveMatchForPlayer } from "@/lib/matchmaking/service";
import { getServiceRoleClient } from "@/lib/supabase/server";

const PLAYER_ID = "player-abc";

type PlayerSelectResult = {
  data: { status: string } | null;
  error: { message: string } | null;
};

type UpdateResult = { error: { message: string } | null };

function buildClient(options: {
  selectResult: PlayerSelectResult;
  updateResult?: UpdateResult;
}) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(options.selectResult),
  };

  const updateEqChain = {
    eq: vi.fn(),
  };
  updateEqChain.eq.mockImplementation(() => updateEqChain);

  const updateResultThenable = {
    then: (resolve: (v: UpdateResult) => unknown) =>
      Promise.resolve(options.updateResult ?? { error: null }).then(resolve),
  };

  const updateChain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(updateResultThenable),
      }),
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "players") {
        return { ...selectChain, ...updateChain };
      }
      return selectChain;
    }),
    _updateSpy: updateChain.update,
  };
}

beforeEach(() => {
  vi.mocked(findActiveMatchForPlayer).mockReset();
});

describe("healStuckInMatchStatus", () => {
  test("does nothing when player status is already 'available'", async () => {
    const client = buildClient({
      selectResult: { data: { status: "available" }, error: null },
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(client as never);

    await healStuckInMatchStatus(PLAYER_ID);

    expect(findActiveMatchForPlayer).not.toHaveBeenCalled();
    expect(client._updateSpy).not.toHaveBeenCalled();
  });

  test("does nothing when status is 'in_match' AND an active match exists", async () => {
    const client = buildClient({
      selectResult: { data: { status: "in_match" }, error: null },
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(client as never);
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue({
      id: "match-1",
      state: "in_progress",
    });

    await healStuckInMatchStatus(PLAYER_ID);

    expect(findActiveMatchForPlayer).toHaveBeenCalledWith(client, PLAYER_ID);
    expect(client._updateSpy).not.toHaveBeenCalled();
  });

  test("resets status to 'available' when stuck 'in_match' with no active match", async () => {
    const client = buildClient({
      selectResult: { data: { status: "in_match" }, error: null },
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(client as never);
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue(null);

    await healStuckInMatchStatus(PLAYER_ID);

    expect(client._updateSpy).toHaveBeenCalledTimes(1);
    const updatePayload = client._updateSpy.mock.calls[0]?.[0] as {
      status: string;
      last_seen_at: string;
    };
    expect(updatePayload.status).toBe("available");
    expect(typeof updatePayload.last_seen_at).toBe("string");
  });

  test("swallows findActiveMatchForPlayer errors and still heals", async () => {
    const client = buildClient({
      selectResult: { data: { status: "in_match" }, error: null },
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(client as never);
    vi.mocked(findActiveMatchForPlayer).mockRejectedValue(
      new Error("transient DB error"),
    );

    await expect(healStuckInMatchStatus(PLAYER_ID)).resolves.toBeUndefined();

    expect(client._updateSpy).toHaveBeenCalledTimes(1);
  });
});
