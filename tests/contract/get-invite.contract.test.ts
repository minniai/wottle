import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/matchmaking/inviteService", () => ({
  expireStaleInvites: vi.fn(),
  listPendingInvites: vi.fn(),
  getOutgoingInvite: vi.fn(),
  sendDirectInvite: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));

import { readLobbySession } from "@/lib/matchmaking/profile";
import { expireStaleInvites, getOutgoingInvite, listPendingInvites } from "@/lib/matchmaking/inviteService";
import { GET } from "@/app/api/lobby/invite/route";

const session = { token: "t", issuedAt: 0, player: { id: "nari", username: "nari", displayName: "Nari", status: "available" as const, lastSeenAt: "" } };

describe("GET /api/lobby/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expires stale challenges first, then returns the pending ones and the viewer's own latest", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session as never);
    const order: string[] = [];
    vi.mocked(expireStaleInvites).mockImplementation(async () => (order.push("expire"), []));
    vi.mocked(listPendingInvites).mockImplementation(async () => (order.push("list"), []));
    vi.mocked(getOutgoingInvite).mockImplementation(async () => (order.push("outgoing"), { id: "i1", status: "expired", recipientName: "Kári", recipientInMatch: false }));

    const body = await (await GET()).json();

    expect(order[0]).toBe("expire");
    expect(body).toEqual({ pending: [], outgoing: { id: "i1", status: "expired", recipientName: "Kári", recipientInMatch: false } });
    expect(getOutgoingInvite).toHaveBeenCalledWith(expect.anything(), "nari");
  });
});
