import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/matchmaking/profile");
  return {
    ...actual,
    readLobbySession: vi.fn(),
  };
});

vi.mock("@/lib/matchmaking/service", () => ({
  findActiveMatchForPlayer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/matchmaking/attention", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  recordAttention: vi.fn(async () => undefined),
}));

vi.mock("@/lib/matchmaking/tableStatus", () => ({
  readTableStatus: vi.fn(async () => ({ cooldownUntil: null, notice: null })),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import { findActiveMatchForPlayer } from "@/lib/matchmaking/service";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/match/active/route";
import { recordAttention } from "@/lib/matchmaking/attention";
import { readTableStatus } from "@/lib/matchmaking/tableStatus";

const request = (query = "") => new Request(`http://localhost/api/match/active${query}`);

const session = {
  expiresAt: Date.now() + 3_600_000,
  issuedAt: Date.now(),
  player: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    username: "tester-alpha",
    displayName: "Tester Alpha",
  },
};

describe("GET /api/match/active", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockReset();
    vi.mocked(findActiveMatchForPlayer).mockReset();
    vi.mocked(getServiceRoleClient).mockClear();
  });

  it("returns the active match summary when one exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue({
      id: "11111111-2222-3333-4444-555555555555",
      state: "pending",
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        match: {
          id: expect.any(String),
          state: "pending",
        },
      })
    );
    expect(getServiceRoleClient).toHaveBeenCalled();
    expect(findActiveMatchForPlayer).toHaveBeenCalledWith(expect.any(Object), session.player.id);
  });

  it("returns null match when the user is not authenticated", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ match: null, cooldownUntil: null, notice: null });
    expect(getServiceRoleClient).not.toHaveBeenCalled();
  });

  it("returns 500 when the lookup fails", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(findActiveMatchForPlayer).mockRejectedValue(new Error("supabase offline"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.match).toBeNull();
    expect(payload.error).toMatch(/supabase offline/i);
  });

  it("records the tab's visibility and last input (spec 069 R5)", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue(null);
    await GET(request("?visible=1&inputAgoMs=4200"));
    expect(recordAttention).toHaveBeenCalledWith(expect.any(Object), session.player.id, { visible: true, inputAgoMs: 4200 });
  });

  it("records nothing without an attention report", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue(null);
    vi.mocked(recordAttention).mockClear();
    await GET(request());
    expect(recordAttention).not.toHaveBeenCalled();
  });

  it("carries the cooldown and a missed table's notice (spec 069 T042, T054)", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(session);
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue(null);
    vi.mocked(readTableStatus).mockResolvedValueOnce({ cooldownUntil: "2026-09-23T12:05:00.000Z", notice: "table_missed" });
    const payload = await (await GET(request())).json();
    expect(payload).toEqual({ match: null, cooldownUntil: "2026-09-23T12:05:00.000Z", notice: "table_missed" });
  });
});
