import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/logWriter", () => ({ writeMatchLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/realtime/pokes", () => ({ pokePlayers: vi.fn(async () => undefined) }));
vi.mock("@/lib/match/rematchService", () => ({ requestRematch: vi.fn(), matchPlayers: vi.fn() }));

import { requestRematchAction } from "@/app/actions/match/requestRematch";
import { writeMatchLog } from "@/lib/match/logWriter";
import { matchPlayers, requestRematch } from "@/lib/match/rematchService";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { pokePlayers } from "@/lib/realtime/pokes";

const MATCH = "11111111-1111-4111-8111-111111111111";

describe("requestRematchAction (spec 071)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: "me" } } as never);
    vi.mocked(matchPlayers).mockResolvedValue(["me", "them"]);
  });

  it("sends through the one locked function and pokes both players", async () => {
    vi.mocked(requestRematch).mockResolvedValue({ status: "sent", requestId: "r1", expiresAt: "2026-09-24T12:00:30.000Z" });
    expect(await requestRematchAction(MATCH)).toEqual({ status: "sent", expiresAt: "2026-09-24T12:00:30.000Z" });
    expect(requestRematch).toHaveBeenCalledWith(expect.anything(), MATCH, "me");
    expect(assertWithinRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: "match:rematch", limit: 6, identifier: "me" }));
    expect(pokePlayers).toHaveBeenCalledWith(["me", "them"], "rematch");
    expect(writeMatchLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "match.rematch.requested" }));
  });

  it("returns the new match when the other player had asked too", async () => {
    vi.mocked(requestRematch).mockResolvedValue({ status: "accepted", newMatchId: "m2" });
    expect(await requestRematchAction(MATCH)).toEqual({ status: "accepted", matchId: "m2" });
    expect(pokePlayers).toHaveBeenCalledWith(["me", "them"], "rematch");
  });

  it("says why a request was refused, and pokes nobody", async () => {
    vi.mocked(requestRematch).mockResolvedValue({ status: "refused", reason: "window_closed" });
    expect(await requestRematchAction(MATCH)).toEqual({ status: "refused", reason: "window_closed" });
    expect(pokePlayers).not.toHaveBeenCalled();
  });

  it("needs a session and a match id", async () => {
    await expect(requestRematchAction("nope")).rejects.toThrow();
    vi.mocked(readLobbySession).mockResolvedValue(null);
    await expect(requestRematchAction(MATCH)).rejects.toThrow("Authentication required.");
  });
});
