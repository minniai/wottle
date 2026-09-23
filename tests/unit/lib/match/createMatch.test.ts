import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { acceptInvite, acceptRematch, pairFromQueue } from "@/lib/match/createMatch";

function clientReturning(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { client: { rpc } as never, rpc };
}

describe("match creation wrappers (spec 067)", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should accept a challenge through accept_invite with the invite time-to-live", async () => {
    vi.stubEnv("PLAYTEST_INVITE_EXPIRY_SECONDS", "60");
    const { client, rpc } = clientReturning({ status: "created", match_id: "m1" });
    await expect(acceptInvite(client, { inviteId: "i1", actorId: "p1" })).resolves.toEqual({ status: "created", matchId: "m1" });
    expect(rpc).toHaveBeenCalledWith("accept_invite", { p_invite: "i1", p_actor: "p1", p_ttl_seconds: 60, p_origin: "challenge" });
  });

  it("should default the time-to-live to 30 seconds", async () => {
    const { client, rpc } = clientReturning({ status: "created", match_id: "m1" });
    await acceptInvite(client, { inviteId: "i1", actorId: "p1", origin: "crossed_challenge" });
    expect(rpc).toHaveBeenCalledWith("accept_invite", expect.objectContaining({ p_ttl_seconds: 30, p_origin: "crossed_challenge" }));
  });

  it("should name the busy player on a refusal", async () => {
    const { client } = clientReturning({ status: "busy", player_id: "p2" });
    await expect(acceptInvite(client, { inviteId: "i1", actorId: "p1" })).resolves.toEqual({ status: "busy", playerId: "p2" });
  });

  it("should pass the other refusals through by name", async () => {
    for (const status of ["not_pending", "not_recipient", "expired"] as const) {
      const { client } = clientReturning({ status });
      await expect(acceptInvite(client, { inviteId: "i1", actorId: "p1" })).resolves.toEqual({ status });
    }
  });

  it("should accept a rematch through accept_rematch", async () => {
    const { client, rpc } = clientReturning({ status: "created", match_id: "m2" });
    await expect(acceptRematch(client, { requestId: "r1", actorId: "p1", origin: "crossed_rematch" })).resolves.toEqual({ status: "created", matchId: "m2" });
    expect(rpc).toHaveBeenCalledWith("accept_rematch", { p_request: "r1", p_actor: "p1", p_origin: "crossed_rematch" });
  });

  it("should pair two searchers through pair_from_queue", async () => {
    const { client, rpc } = clientReturning({ status: "not_searching" });
    await expect(pairFromQueue(client, { selfId: "p1", opponentId: "p2", language: "en" })).resolves.toEqual({ status: "not_searching" });
    expect(rpc).toHaveBeenCalledWith("pair_from_queue", { p_self: "p1", p_opponent: "p2", p_language: "en" });
  });

  it("should start a table both players sat at on creation (spec 069 T009)", async () => {
    const rpc = vi.fn(async (fn: string) => ({
      data: fn === "accept_invite" ? { status: "created", match_id: "m3", seats: { a: true, b: true } } : { status: "started", startedAt: "a", deadlineAt: "b", serverNow: "c" },
      error: null,
    }));
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "m3", board_seed: "s", language: "is" }, error: null }) }) }) }));
    await expect(acceptInvite({ rpc, from } as never, { inviteId: "i1", actorId: "p1", origin: "crossed_challenge" })).resolves.toEqual({ status: "created", matchId: "m3" });
    expect(rpc).toHaveBeenCalledWith("start_table_if_seated", expect.objectContaining({ p_match: "m3" }));
  });

  it("should leave a table with an empty seat waiting (spec 069 T009)", async () => {
    const { client, rpc } = clientReturning({ status: "created", match_id: "m4", seats: { a: false, b: true } });
    await acceptInvite(client, { inviteId: "i1", actorId: "p1" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("should throw when the database call fails", async () => {
    const { client } = clientReturning(null, { message: "connection reset" });
    await expect(pairFromQueue(client, { selfId: "p1", opponentId: "p2", language: "en" })).rejects.toThrow(/pair_from_queue: connection reset/);
  });

  it("should throw on a reply it does not understand", async () => {
    const { client } = clientReturning({ status: "maybe" });
    await expect(acceptInvite(client, { inviteId: "i1", actorId: "p1" })).rejects.toThrow(/accept_invite/);
  });
});
