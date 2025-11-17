import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/matchmaking/profile", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("../../lib/matchmaking/profile");
  return {
    ...actual,
    readLobbySession: vi.fn(),
  };
});

vi.mock("../../lib/matchmaking/inviteService", () => ({
  sendDirectInvite: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({})),
}));

import { readLobbySession } from "../../lib/matchmaking/profile";
import { sendDirectInvite } from "../../lib/matchmaking/inviteService";
import { getServiceRoleClient } from "../../lib/supabase/server";
import { POST } from "../../app/api/lobby/invite/route";

function createRequest(body: unknown) {
  return new Request("http://localhost/api/lobby/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = {
  token: "session-token",
  issuedAt: Date.now(),
  player: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    username: "tester-alpha",
    displayName: "Tester Alpha",
    status: "available" as const,
    lastSeenAt: new Date().toISOString(),
    avatarUrl: null,
  },
};

describe("POST /api/lobby/invite", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockReset();
    vi.mocked(sendDirectInvite).mockReset();
    vi.mocked(getServiceRoleClient).mockClear();
  });

  it("returns 200 when the invite service succeeds", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(sendDirectInvite).mockResolvedValue({
      inviteId: "11111111-2222-3333-4444-555555555555",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    });

    const response = await POST(
      createRequest({ recipientId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        inviteId: expect.any(String),
        expiresAt: expect.any(String),
      })
    );

    expect(getServiceRoleClient).toHaveBeenCalled();
    expect(sendDirectInvite).toHaveBeenCalledWith(expect.any(Object), {
      senderId: session.player.id,
      recipientId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ttlSeconds: expect.any(Number),
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const response = await POST(
      createRequest({ recipientId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(sendDirectInvite).not.toHaveBeenCalled();
  });

  it("returns 400 when the payload is missing a recipient", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);

    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(sendDirectInvite).not.toHaveBeenCalled();
  });
});


