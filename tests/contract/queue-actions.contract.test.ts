/**
 * Spec 069 T048: the queue's poll carries the tab's attention, and a hidden tab
 * sends a beacon that pauses the search at once.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/inviteService", () => ({ startAutoQueue: vi.fn(async () => ({ status: "queued", queuedAt: "t" })) }));

import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { POST as pause } from "@/app/api/matchmaking/pause/route";
import { startAutoQueue } from "@/lib/matchmaking/inviteService";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const SESSION = { issuedAt: Date.now(), player: { id: "p1", username: "birna", displayName: "Birna" } };

describe("startQueueAction (spec 069)", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    vi.mocked(getServiceRoleClient).mockReturnValue({} as never);
  });

  it("passes the tab's attention to the queue, and the join time back", async () => {
    await expect(startQueueAction({ language: "is", attention: { visible: false, inputAgoMs: 1200 } })).resolves.toMatchObject({ status: "queued", queuedAt: "t" });
    expect(startAutoQueue).toHaveBeenCalledWith({}, { playerId: "p1", language: "is", attention: { visible: false, inputAgoMs: 1200 } });
  });

  it("drops a malformed attention report rather than trusting it", async () => {
    await startQueueAction({ language: "is", attention: { visible: "yes", inputAgoMs: -1 } as never });
    expect(startAutoQueue).toHaveBeenLastCalledWith({}, { playerId: "p1", language: "is" });
  });
});

describe("POST /api/matchmaking/pause (spec 069 FR-021)", () => {
  const update = vi.fn();
  beforeEach(() => {
    update.mockReset().mockReturnValue({ eq: () => ({ eq: vi.fn(async () => ({ error: null })) }) });
    vi.mocked(getServiceRoleClient).mockReturnValue({ from: () => ({ update }) } as never);
  });

  it("pauses the session's search at once", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    const res = await pause();
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith({ search_paused: true });
  });

  it("without a session does nothing", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    const res = await pause();
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});
