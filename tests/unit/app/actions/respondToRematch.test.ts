import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/logWriter", () => ({ writeMatchLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/realtime/pokes", () => ({ pokePlayers: vi.fn(async () => undefined) }));
vi.mock("@/lib/match/rematchService", () => ({ pendingRequestOf: vi.fn(), declineRematch: vi.fn(), withdrawRematch: vi.fn(), matchPlayers: vi.fn() }));
vi.mock("@/lib/match/createMatch", () => ({ acceptRematch: vi.fn() }));

import { acceptRematchAction, declineRematchAction } from "@/app/actions/match/respondToRematch";
import { withdrawRematchAction } from "@/app/actions/match/withdrawRematch";
import { acceptRematch } from "@/lib/match/createMatch";
import { declineRematch, matchPlayers, pendingRequestOf, withdrawRematch } from "@/lib/match/rematchService";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { pokePlayers } from "@/lib/realtime/pokes";

const MATCH = "11111111-1111-4111-8111-111111111111";

describe("answering and withdrawing a rematch (spec 071)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: "me" } } as never);
    vi.mocked(matchPlayers).mockResolvedValue(["me", "them"]);
    vi.mocked(pendingRequestOf).mockResolvedValue({ id: "r1", requesterId: "them" } as never);
  });

  it("accepts through the one match-creation path and pokes both", async () => {
    vi.mocked(acceptRematch).mockResolvedValue({ status: "created", matchId: "m2" });
    expect(await acceptRematchAction(MATCH)).toEqual({ status: "accepted", matchId: "m2" });
    expect(acceptRematch).toHaveBeenCalledWith(expect.anything(), { requestId: "r1", actorId: "me" });
    expect(pokePlayers).toHaveBeenCalledWith(["me", "them"], "rematch");
  });

  it("reports an expired or busy accept, and pokes both so they read how it ended", async () => {
    vi.mocked(acceptRematch).mockResolvedValue({ status: "expired" });
    expect(await acceptRematchAction(MATCH)).toEqual({ status: "expired" });
    vi.mocked(acceptRematch).mockResolvedValue({ status: "busy", playerId: "them" });
    expect(await acceptRematchAction(MATCH)).toEqual({ status: "busy" });
    expect(pokePlayers).toHaveBeenCalledTimes(2);
  });

  it("declines, and the sender is poked", async () => {
    vi.mocked(declineRematch).mockResolvedValue({ status: "declined" });
    expect(await declineRematchAction(MATCH)).toEqual({ status: "declined" });
    expect(declineRematch).toHaveBeenCalledWith(expect.anything(), "r1", "me");
    expect(pokePlayers).toHaveBeenCalledWith(["me", "them"], "rematch");
  });

  it("withdraws a pending request, from either side", async () => {
    vi.mocked(withdrawRematch).mockResolvedValue({ status: "withdrawn" });
    expect(await withdrawRematchAction(MATCH)).toEqual({ status: "withdrawn" });
    expect(withdrawRematch).toHaveBeenCalledWith(expect.anything(), "r1", "me");
  });

  it("has nothing to answer when no request is pending", async () => {
    vi.mocked(pendingRequestOf).mockResolvedValue(null);
    expect(await acceptRematchAction(MATCH)).toEqual({ status: "refused" });
    expect(await declineRematchAction(MATCH)).toEqual({ status: "refused" });
    expect(await withdrawRematchAction(MATCH)).toEqual({ status: "refused" });
    expect(pokePlayers).not.toHaveBeenCalled();
  });
});
